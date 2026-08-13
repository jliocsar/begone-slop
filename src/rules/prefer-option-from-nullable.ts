import * as Effect from 'effect/Effect'
import { Diagnostic, type ESTree, Rule, RuleContext } from 'effect-oxlint'

const OPTION_MODULE = 'Option'

const NULLABLE_OPERATORS = new Set(['!==', '!='])

const MESSAGE =
  'Use Option.fromNullable instead of a nullable ternary with Option.some and Option.none.'

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

function isNullableOptionTernary(node: ESTree.Node): boolean {
  if (node.type !== 'ConditionalExpression') {
    return false
  }

  return (
    testsAgainstNull(node.test) &&
    callsOptionMethod(node.consequent, 'some') &&
    callsOptionMethod(node.alternate, 'none')
  )
}

export default Rule.define({
  name: 'prefer-option-from-nullable',
  meta: Rule.meta({
    type: 'problem',
    description: 'require Option.fromNullable over a nullable Option.some/Option.none ternary',
    messages: { preferOptionFromNullable: MESSAGE },
  }),
  create: function* () {
    const context = yield* RuleContext

    return {
      ConditionalExpression: (node: ESTree.Node) =>
        isNullableOptionTernary(node)
          ? context.report(Diagnostic.fromId({ node, messageId: 'preferOptionFromNullable' }))
          : Effect.void,
    }
  },
})
