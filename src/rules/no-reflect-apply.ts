import { defineRule } from '@oxlint/plugins'
import { isGlobalReflectMethodCall } from '../shared/reflect-method.ts'

const METHOD = 'apply'

const MESSAGE =
  'Replace `Reflect.apply` with a typed function call. Model dynamic dispatch behind a named interface.'

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid Reflect.apply in favour of a typed function call' },
    messages: { reflectApply: MESSAGE },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (isGlobalReflectMethodCall(context.sourceCode, node.callee, METHOD)) {
          context.report({ node, messageId: 'reflectApply' })
        }
      },
    }
  },
})
