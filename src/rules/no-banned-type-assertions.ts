import type { ESTree } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'

const BANNED_TYPE_ANNOTATIONS = new Set(['TSAnyKeyword', 'TSNeverKeyword', 'TSUnknownKeyword'])

const MESSAGE =
  'Asserting to any, never or unknown discards the very checking you are about to rely on. Give the value a real type, or make the function generic over it.'

function assertsToBannedType(node: ESTree.TSAsExpression | ESTree.TSTypeAssertion): boolean {
  return BANNED_TYPE_ANNOTATIONS.has(node.typeAnnotation.type)
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid assertions to any, never or unknown' },
    messages: { bannedTypeAssertion: MESSAGE },
  },
  create(context) {
    return {
      TSAsExpression(node) {
        if (assertsToBannedType(node)) {
          context.report({ node, messageId: 'bannedTypeAssertion' })
        }
      },
      TSTypeAssertion(node) {
        if (assertsToBannedType(node)) {
          context.report({ node, messageId: 'bannedTypeAssertion' })
        }
      },
    }
  },
})
