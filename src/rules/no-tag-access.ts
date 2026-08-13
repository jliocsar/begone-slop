import * as Effect from 'effect/Effect'
import { Diagnostic, type ESTree, Rule, RuleContext } from 'effect-oxlint'

const TAG = '_tag'

const MESSAGE =
  'Do not read `_tag` — the `_` prefix means private. Use Match.tag/Match.tags/Match.tagsExhaustive, a library guard (Cause.isTimeoutError, Exit.isFailure, Result.isFailure), or `instanceof` where the module instance is shared. For a nested reason union (SqlError, AiError), use Effect.catchReason/Effect.catchReasons/Effect.unwrapReason, or Match.value(error.reason).pipe(Match.tagsExhaustive({ ... })).'

function namesTheTag(computed: boolean, key: ESTree.Node): boolean {
  if (computed) {
    return key.type === 'Literal' && key.value === TAG
  }

  return key.type === 'Identifier' && key.name === TAG
}

function definesTheTag(node: ESTree.MemberExpression): boolean {
  const { parent } = node

  return parent.type === 'AssignmentExpression' && parent.left === node && parent.operator === '='
}

function readsTheTag(node: ESTree.Node): boolean {
  if (node.type === 'MemberExpression') {
    return namesTheTag(node.computed, node.property) && !definesTheTag(node)
  }

  if (node.type === 'Property') {
    return node.parent.type === 'ObjectPattern' && namesTheTag(node.computed, node.key)
  }

  return false
}

export default Rule.define({
  name: 'no-tag-access',
  meta: Rule.meta({
    type: 'problem',
    description: 'forbid reading the private `_tag` discriminant directly',
    messages: { noTagAccess: MESSAGE },
  }),
  create: function* () {
    const context = yield* RuleContext

    const report = (node: ESTree.Node) =>
      readsTheTag(node)
        ? context.report(Diagnostic.fromId({ node, messageId: 'noTagAccess' }))
        : Effect.void

    return { MemberExpression: report, Property: report }
  },
})
