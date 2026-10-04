import { defineRule } from '@oxlint/plugins'
import { isGlobalReflectMethodCall } from '../shared/reflect-method.ts'

const METHOD = 'get'

const MESSAGE =
  'Replace `Reflect.get` with typed property access. Parse dynamic input into a named domain type before reading it.'

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid Reflect.get in favour of typed property access' },
    messages: { reflectGet: MESSAGE },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (isGlobalReflectMethodCall(context.sourceCode, node.callee, METHOD)) {
          context.report({ node, messageId: 'reflectGet' })
        }
      },
    }
  },
})
