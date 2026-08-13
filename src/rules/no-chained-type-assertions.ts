/**
 * `value as unknown as Target` launders one type into another by way of a type
 * that means nothing, so the checker has no evidence left to disagree with.
 *
 * Only the outermost assertion of a chain reports, so a chain is one diagnostic
 * however long it is. A chain made entirely of `as const` is untouched: those
 * narrow rather than override.
 *
 * Report-only — the fix is the precise type, or parsing the input at its
 * boundary, and only the author has either.
 */

import * as Arr from 'effect/Array'
import * as Effect from 'effect/Effect'
import { Diagnostic, type ESTree, Rule, RuleContext } from 'effect-oxlint'
import {
  isConstAssertion,
  isTypeAssertion,
  type TypeAssertion,
  unwrapParenthesizedExpression,
} from '../shared/type-assertion.ts'

const MESSAGE =
  'This assertion chain discards type evidence. Keep the original precise type, or parse untrusted input at its boundary before narrowing it.'

/** The widest parenthesization wrapping an expression — see the shared helper. */
function outermostParenthesization(current: ESTree.Expression): ESTree.Expression {
  const { parent } = current

  return parent.type === 'ParenthesizedExpression' && parent.expression === current
    ? outermostParenthesization(parent)
    : current
}

/**
 * Whether nothing above this assertion asserts again, so the walk down covers
 * the whole chain exactly once.
 */
function isOutermostAssertionInChain(node: TypeAssertion): boolean {
  const outermost = outermostParenthesization(node)
  const { parent } = outermost

  return !isTypeAssertion(parent) || parent.expression !== outermost
}

/** Every assertion from this one down, parentheses ignored. */
function assertionChain(expression: ESTree.Expression): readonly TypeAssertion[] {
  const current = unwrapParenthesizedExpression(expression)

  return isTypeAssertion(current) ? Arr.prepend(assertionChain(current.expression), current) : []
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
