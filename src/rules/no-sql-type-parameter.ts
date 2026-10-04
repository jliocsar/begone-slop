import type { ESTree, SourceCode } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { findVariable, isConstDeclarator, variableDeclarator } from '../shared/binding-scope.ts'
import { stringLiteralValue } from '../shared/literal.ts'

const SQL_TAG = 'sql'

const UNSAFE = 'unsafe'

const MESSAGE =
  'Do not use sql<Type> templates. Use a typed query API or a validated schema instead.'

function memberName(node: ESTree.MemberExpression): string | undefined {
  if (node.computed) {
    return stringLiteralValue(node.property)
  }

  return node.property.type === 'Identifier' ? node.property.name : undefined
}

function namesSqlTag(tag: ESTree.Node): boolean {
  if (tag.type === 'Identifier') {
    return tag.name === SQL_TAG
  }

  return tag.type === 'MemberExpression' && memberName(tag) === SQL_TAG
}

function isSqlTag(sourceCode: SourceCode, tag: ESTree.Node): boolean {
  if (namesSqlTag(tag)) {
    return true
  }

  const variable =
    tag.type === 'Identifier' ? findVariable(sourceCode.getScope(tag), tag.name) : undefined
  const declarator = variable === undefined ? undefined : variableDeclarator(variable)

  return (
    declarator !== undefined &&
    isConstDeclarator(declarator) &&
    declarator.init !== null &&
    namesSqlTag(declarator.init)
  )
}

function isUnsafeSqlCall(sourceCode: SourceCode, callee: ESTree.Node): boolean {
  return (
    callee.type === 'MemberExpression' &&
    memberName(callee) === UNSAFE &&
    isSqlTag(sourceCode, callee.object)
  )
}

function hasTypeArguments(node: ESTree.TaggedTemplateExpression | ESTree.CallExpression): boolean {
  return node.typeArguments !== undefined && node.typeArguments !== null
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'forbid sql<Type> tagged templates in favour of a typed query API or a schema',
    },
    messages: { noSqlTypeParameter: MESSAGE },
  },
  create(context) {
    return {
      TaggedTemplateExpression(node) {
        if (isSqlTag(context.sourceCode, node.tag) && hasTypeArguments(node)) {
          context.report({ node, messageId: 'noSqlTypeParameter' })
        }
      },
      CallExpression(node) {
        if (isUnsafeSqlCall(context.sourceCode, node.callee) && hasTypeArguments(node)) {
          context.report({ node, messageId: 'noSqlTypeParameter' })
        }
      },
    }
  },
})
