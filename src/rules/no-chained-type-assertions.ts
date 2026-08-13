import * as Arr from 'effect/Array'
import * as Effect from 'effect/Effect'
import { Diagnostic, type ESTree, Rule, RuleContext } from 'effect-oxlint'
import { isConstAssertion, isTypeAssertion, type TypeAssertion } from '../shared/type-assertion.ts'

const MESSAGE =
  'This assertion chain discards type evidence. Keep the original precise type, or parse untrusted input at its boundary before narrowing it.'

function isOutermostAssertionInChain(node: TypeAssertion): boolean {
  const { parent } = node

  return !isTypeAssertion(parent) || parent.expression !== node
}

function assertionChain(expression: ESTree.Expression): readonly TypeAssertion[] {
  return isTypeAssertion(expression)
    ? Arr.prepend(assertionChain(expression.expression), expression)
    : []
}

function isForbiddenAssertionChain(node: TypeAssertion): boolean {
  const chain = assertionChain(node)

  return chain.length > 1 && chain.some((assertion) => !isConstAssertion(assertion))
}

export default Rule.define({
  name: 'no-chained-type-assertions',
  meta: Rule.meta({
    type: 'problem',
    description: 'forbid chained type assertions, including parenthesized chains',
    messages: { chained: MESSAGE },
  }),
  create: function* () {
    const context = yield* RuleContext

    const report = (node: ESTree.Node) => {
      if (!isTypeAssertion(node) || !isOutermostAssertionInChain(node)) {
        return Effect.void
      }

      return isForbiddenAssertionChain(node)
        ? context.report(Diagnostic.fromId({ node, messageId: 'chained' }))
        : Effect.void
    }

    return { TSAsExpression: report, TSTypeAssertion: report }
  },
})
