/**
 * `_tag` is Effect's private discriminant. Every direct read is a hand-rolled
 * match a new variant falls through, or a guard the library already provides.
 * Nested `reason` unions (SqlError, AiError) are flagged too.
 *
 * Any read counts, not just comparisons. Defining a tag is untouched: property
 * keys, `this._tag = 'Foo'` (a write) and type positions are all fine.
 *
 * Report-only — the fix depends on the surrounding shape.
 */

import * as Effect from 'effect/Effect'
import { Diagnostic, type ESTree, Rule, RuleContext } from 'effect-oxlint'

const TAG = '_tag'

const MESSAGE =
  'Do not read `_tag` — the `_` prefix means private. Use Match.tag/Match.tags/Match.tagsExhaustive, a library guard (Cause.isTimeoutError, Exit.isFailure, Result.isFailure), or `instanceof` where the module instance is shared. For a nested reason union (SqlError, AiError), use Effect.catchReason/Effect.catchReasons/Effect.unwrapReason, or Match.value(error.reason).pipe(Match.tagsExhaustive({ ... })).'

/**
 * `x._tag` and `x['_tag']`, but not `x[tag]` — a computed access through a
 * variable is unresolvable here and rare enough to leave to review.
 */
function namesTheTag(computed: boolean, key: ESTree.Node): boolean {
  if (computed) {
    return key.type === 'Literal' && key.value === TAG
  }

  return key.type === 'Identifier' && key.name === TAG
}

/**
 * `this._tag = 'Manual'` in a hand-rolled tagged class DEFINES the discriminant;
 * only reading one is the problem. A compound assignment (`_tag += x`) reads
 * before it writes, so exempt plain `=` alone.
 */
function definesTheTag(node: ESTree.MemberExpression): boolean {
  const { parent } = node

  return parent.type === 'AssignmentExpression' && parent.left === node && parent.operator === '='
}

function readsTheTag(node: ESTree.Node): boolean {
  if (node.type === 'MemberExpression') {
    return namesTheTag(node.computed, node.property) && !definesTheTag(node)
  }

  // `const { _tag } = error` is the same read with a rename in front of it.
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
