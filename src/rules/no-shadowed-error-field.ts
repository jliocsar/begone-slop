import type { ESTree } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { stringLiteralValue } from '../shared/literal.ts'

const SHADOWED_PROPERTIES = new Set(['name', 'stack'])

const ERROR_CLASS_FACTORIES = new Set(['TaggedErrorClass', 'ErrorClass'])

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

  return node.arguments.find(
    (argument): argument is ESTree.ObjectExpression => argument.type === 'ObjectExpression',
  )
}

function propertyName(property: ESTree.ObjectProperty): string | undefined {
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
    return {
      CallExpression(node) {
        const fields = fieldsObject(node)

        if (fields === undefined) {
          return
        }

        for (const property of fields.properties) {
          const field = property.type === 'Property' ? propertyName(property) : undefined

          if (field !== undefined && SHADOWED_PROPERTIES.has(field)) {
            context.report({ node: property, messageId: 'shadowedErrorField', data: { field } })
          }
        }
      },
    }
  },
})
