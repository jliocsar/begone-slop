import type { ESTree } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'

const TAG = '_tag'

const MESSAGE =
  'Do not read `_tag` — a read keeps compiling when a variant is added, so the new case goes unhandled. Use Match.tagsExhaustive, Match.tag/Match.tags, a library guard (Cause.isTimeoutError, Exit.isFailure, Result.isFailure), or `instanceof` where the module instance is shared. For a nested reason union (SqlError, AiError), use Effect.catchReason/Effect.catchReasons/Effect.unwrapReason, or Match.value(error.reason).pipe(Match.tagsExhaustive({ ... })).'

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

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid reading the `_tag` discriminant directly' },
    messages: { noTagAccess: MESSAGE },
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (namesTheTag(node.computed, node.property) && !definesTheTag(node)) {
          context.report({ node, messageId: 'noTagAccess' })
        }
      },
      Property(node) {
        if (node.parent.type === 'ObjectPattern' && namesTheTag(node.computed, node.key)) {
          context.report({ node, messageId: 'noTagAccess' })
        }
      },
    }
  },
})
