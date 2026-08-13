/**
 * An assertion to `any`, `never` or `unknown` erases the type instead of
 * describing it, so every downstream check is decided by the assertion rather
 * than by the code.
 *
 * Both assertion spellings count: `x as any` and the angle-bracket `<any>x`.
 * `satisfies`, `as const` and an assertion to a named type are untouched — only
 * the three keywords are banned. In `x as unknown as Foo` that leaves the inner
 * `x as unknown` reported and the outer one, whose annotation is a type
 * reference, silent.
 *
 * Report-only — the fix is a real type or a generic, which only the author has.
 */

import * as Effect from 'effect/Effect'
import { Diagnostic, type ESTree, Rule, RuleContext } from 'effect-oxlint'

const BANNED_TYPE_ANNOTATIONS = new Set(['TSAnyKeyword', 'TSNeverKeyword', 'TSUnknownKeyword'])

const MESSAGE = 'Do not assert to any, never, or unknown. Fix the type or use generics.'

function assertsToBannedType(node: ESTree.Node): boolean {
  if (node.type !== 'TSAsExpression' && node.type !== 'TSTypeAssertion') {
    return false
  }

  return BANNED_TYPE_ANNOTATIONS.has(node.typeAnnotation.type)
}

export default Rule.define({
  name: 'no-banned-type-assertions',
  meta: Rule.meta({
    type: 'problem',
    description: 'forbid assertions to any, never or unknown',
    messages: { bannedTypeAssertion: MESSAGE },
  }),
  create: function* () {
    const context = yield* RuleContext

    const report = (node: ESTree.Node) =>
      assertsToBannedType(node)
        ? context.report(Diagnostic.fromId({ node, messageId: 'bannedTypeAssertion' }))
        : Effect.void

    return { TSAsExpression: report, TSTypeAssertion: report }
  },
})
