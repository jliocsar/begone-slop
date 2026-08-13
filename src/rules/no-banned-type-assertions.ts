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
