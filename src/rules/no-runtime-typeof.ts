import { defineRule } from '@oxlint/plugins'

const TYPEOF_OPERATOR = 'typeof'

const MESSAGE =
  'A `typeof` check narrows a representation without establishing its contract. Parse input at its I/O boundary, then branch on the domain value.'

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid runtime typeof checks on values that were never parsed' },
    messages: { runtimeTypeof: MESSAGE },
  },
  create(context) {
    return {
      UnaryExpression(node) {
        if (node.operator === TYPEOF_OPERATOR) {
          context.report({ node, messageId: 'runtimeTypeof' })
        }
      },
    }
  },
})
