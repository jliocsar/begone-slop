import type { Rule } from '@oxlint/plugins'

const MESSAGE =
  'A switch falls through silently and never reports a missing case. Use Match from Effect, which can be made exhaustive.'

export default {
  meta: { type: 'problem', docs: { description: MESSAGE } },
  create(context) {
    return {
      SwitchStatement(node) {
        context.report({ node, message: MESSAGE })
      },
    }
  },
} satisfies Rule
