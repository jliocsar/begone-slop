/**
 * `x === 'a' ? … : x === 'b' ? … : …` is a match written by hand: nothing checks
 * that the cases are exhaustive, and every new case pushes the chain further
 * right. `Match` over the same subject says the same thing and can be made
 * exhaustive.
 *
 * Only the OUTERMOST link is visited, and the chain is followed down
 * `.alternate` alone — a ternary nested in `.consequent` is a different shape.
 * Every link must compare the same subject, matched by source text; one that
 * does not aborts the whole chain rather than reporting a shorter prefix.
 *
 * Report-only — the `Match` combinator that fits depends on the cases.
 */

import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import { Diagnostic, type ESTree, Rule, RuleContext, SourceCode } from 'effect-oxlint'

const EQUALITY_OPERATORS = new Set(['==', '===', '!=', '!=='])

/** Two links is already a chain: one ternary is just a ternary. */
const MINIMUM_LITERAL_CHECKS = 2

const MESSAGE = 'Use Match from effect instead of a chained literal ternary.'

/** A template literal with no interpolation is as constant as a `Literal`. */
function isLiteralSide(node: ESTree.Node): boolean {
  return (
    node.type === 'Literal' || (node.type === 'TemplateLiteral' && node.expressions.length === 0)
  )
}

/**
 * The side compared against a literal, or none when this is not a literal check.
 *
 * A literal on the LEFT wins, matching the rule this was ported from: with
 * literals on both sides it is the right-hand text that has to stay identical
 * down the chain.
 */
function comparedSide(test: ESTree.Node): Option.Option<ESTree.Node> {
  if (test.type !== 'BinaryExpression' || !EQUALITY_OPERATORS.has(test.operator)) {
    return Option.none()
  }

  if (isLiteralSide(test.left)) {
    return Option.some(test.right)
  }

  return isLiteralSide(test.right) ? Option.some(test.left) : Option.none()
}

/** Every test in the chain, outermost first, following `.alternate` only. */
function chainTests(node: ESTree.ConditionalExpression): readonly ESTree.Node[] {
  const { alternate } = node

  return alternate.type === 'ConditionalExpression'
    ? [node.test, ...chainTests(alternate)]
    : [node.test]
}

function comparedText(test: ESTree.Node): Effect.Effect<Option.Option<string>, never, RuleContext> {
  return Option.match(comparedSide(test), {
    onNone: () => Effect.succeed(Option.none<string>()),
    onSome: (compared) => SourceCode.getNodeText(compared).pipe(Effect.map(Option.some)),
  })
}

/** One subject for the whole chain, with no link failing to name one. */
function comparesOneSubject(subjects: readonly Option.Option<string>[]): boolean {
  return Option.match(Option.all(subjects), {
    onNone: () => false,
    onSome: (texts) => texts.every((text) => text === texts[0]),
  })
}

export default Rule.define({
  name: 'prefer-effect-match',
  meta: Rule.meta({
    type: 'problem',
    description: 'forbid chained literal ternaries over one subject in favour of Match',
    messages: { preferEffectMatch: MESSAGE },
  }),
  create: function* () {
    const context = yield* RuleContext

    return {
      ConditionalExpression: (node: ESTree.Node) => {
        if (node.type !== 'ConditionalExpression' || node.parent.type === 'ConditionalExpression') {
          return Effect.void
        }

        const tests = chainTests(node)

        if (tests.length < MINIMUM_LITERAL_CHECKS) {
          return Effect.void
        }

        return Effect.forEach(tests, comparedText).pipe(
          Effect.flatMap((subjects) =>
            comparesOneSubject(subjects)
              ? context.report(Diagnostic.fromId({ node, messageId: 'preferEffectMatch' }))
              : Effect.void,
          ),
        )
      },
    }
  },
})
