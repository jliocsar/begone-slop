import { defineRule } from '@oxlint/plugins'

const MESSAGE =
  'try/catch erases the error type and catches failures you never meant to handle. Wrap the throwing call in Effect.try or Effect.tryPromise, or model the failure in the error channel.'

export default defineRule({
  meta: { type: 'problem', docs: { description: MESSAGE } },
  create(context) {
    return {
      TryStatement(node) {
        context.report({ node, message: MESSAGE })
      },
    }
  },
})
