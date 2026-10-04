import type { ESTree } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { stringLiteralValue } from '../shared/literal.ts'

const SHADOWED_PROPERTIES = new Set(['name', 'stack'])
const ERROR_CLASS_FACTORIES = new Set(['TaggedErrorClass', 'ErrorClass'])
const STRUCT_CONSTRUCTOR = 'Struct'
const DATA_ERROR_CONSTRUCTOR = 'Error'
const DATA_TAGGED_ERROR_FACTORY = 'TaggedError'

const MESSAGE =
  "A `{{field}}` field shadows `Error.prototype.{{field}}`, so this error stops identifying itself — `Cause.pretty`, the stack header and OTLP's exception.type/exception.stacktrace all read that property. Name the field for what it holds instead (`userName`, `agentName`, `commandStack`)."

function calleeName(node: ESTree.Expression): string | undefined {
  if (node.type === 'Identifier') {
    return node.name
  }

  if (node.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier') {
    return node.property.name
  }

  return undefined
}

function fieldsObject(node: ESTree.CallExpression): ESTree.ObjectExpression | undefined {
  const curried = node.callee

  if (curried.type !== 'CallExpression') {
    return undefined
  }

  const factoryName = calleeName(curried.callee)

  if (factoryName === undefined || !ERROR_CLASS_FACTORIES.has(factoryName)) {
    return undefined
  }

  return node.arguments.map(structFields).find((fields) => fields !== undefined)
}

function structFields(argument: ESTree.Argument): ESTree.ObjectExpression | undefined {
  if (argument.type === 'ObjectExpression') {
    return argument
  }

  if (argument.type !== 'CallExpression' || calleeName(argument.callee) !== STRUCT_CONSTRUCTOR) {
    return undefined
  }

  const [fields] = argument.arguments

  return fields?.type === 'ObjectExpression' ? fields : undefined
}

function extendsDataError(superClass: ESTree.Expression): boolean {
  return superClass.type === 'CallExpression'
    ? calleeName(superClass.callee) === DATA_TAGGED_ERROR_FACTORY
    : calleeName(superClass) === DATA_ERROR_CONSTRUCTOR
}

function typeArgumentFields(node: ESTree.Class): readonly ESTree.TSSignature[] {
  const { superClass, superTypeArguments } = node
  const [fieldsType] = superTypeArguments?.params ?? []

  if (
    superClass === null ||
    fieldsType?.type !== 'TSTypeLiteral' ||
    !extendsDataError(superClass)
  ) {
    return []
  }

  return fieldsType.members
}

function propertyName(
  property: ESTree.ObjectProperty | ESTree.TSPropertySignature,
): string | undefined {
  if (!property.computed && property.key.type === 'Identifier') {
    return property.key.name
  }

  return stringLiteralValue(property.key)
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: "forbid error schema fields that shadow Error's own properties" },
    messages: { shadowedErrorField: MESSAGE },
  },
  create(context) {
    function reportShadowedField(
      property: ESTree.ObjectProperty | ESTree.TSPropertySignature,
    ): void {
      const field = propertyName(property)

      if (field !== undefined && SHADOWED_PROPERTIES.has(field)) {
        context.report({ node: property, messageId: 'shadowedErrorField', data: { field } })
      }
    }

    function checkTypeArgumentFields(node: ESTree.Class): void {
      for (const member of typeArgumentFields(node)) {
        if (member.type === 'TSPropertySignature') {
          reportShadowedField(member)
        }
      }
    }

    return {
      ClassDeclaration: checkTypeArgumentFields,
      ClassExpression: checkTypeArgumentFields,
      CallExpression(node) {
        const fields = fieldsObject(node)

        if (fields === undefined) {
          return
        }

        for (const property of fields.properties) {
          if (property.type === 'Property') {
            reportShadowedField(property)
          }
        }
      },
    }
  },
})
