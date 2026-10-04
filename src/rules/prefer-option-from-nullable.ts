import type { ESTree } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'

const OPTION_MODULE = 'Option'

const NULLABLE_OPERATORS = new Set(['!==', '!='])

const MESSAGE =
  'Wrapping a null check in Option.some and Option.none restates what Option.fromNullable already does. Call it directly.'

function isNullLiteral(node: ESTree.Node): boolean {
  return node.type === 'Literal' && node.value === null
}

function testsAgainstNull(node: ESTree.Expression): boolean {
  if (node.type !== 'BinaryExpression' || !NULLABLE_OPERATORS.has(node.operator)) {
    return false
  }

  return isNullLiteral(node.left) || isNullLiteral(node.right)
}

function callsOptionMethod(node: ESTree.Expression, method: string): boolean {
  if (node.type !== 'CallExpression') {
    return false
  }

  const callee =
    node.callee.type === 'TSInstantiationExpression' ? node.callee.expression : node.callee

  if (callee.type !== 'MemberExpression') {
    return false
  }

  return (
    callee.object.type === 'Identifier' &&
    callee.object.name === OPTION_MODULE &&
    callee.property.type === 'Identifier' &&
    callee.property.name === method
  )
}

function isNullableOptionTernary(node: ESTree.ConditionalExpression): boolean {
  return (
    testsAgainstNull(node.test) &&
    callsOptionMethod(node.consequent, 'some') &&
    callsOptionMethod(node.alternate, 'none')
  )
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'require Option.fromNullable over a nullable Option.some/Option.none ternary',
    },
    messages: { preferOptionFromNullable: MESSAGE },
  },
  create(context) {
    return {
      ConditionalExpression(node) {
        if (isNullableOptionTernary(node)) {
          context.report({ node, messageId: 'preferOptionFromNullable' })
        }
      },
    }
  },
})
