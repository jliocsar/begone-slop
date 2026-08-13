import * as Effect from 'effect/Effect'
import { Diagnostic, type ESTree, Rule, RuleContext } from 'effect-oxlint'
import { isGlobalReflectMethodCall } from '../shared/reflect-method.ts'

const METHOD = 'get'

const MESSAGE =
  'Replace `Reflect.get` with typed property access. Parse dynamic input into a named domain type before reading it.'

export default Rule.define({
  name: 'no-reflect-get',
  meta: Rule.meta({
    type: 'problem',
    description: 'forbid Reflect.get in favour of typed property access',
    messages: { reflectGet: MESSAGE },
  }),
  create: function* () {
    const context = yield* RuleContext

    return {
      CallExpression: (node: ESTree.Node) => {
        if (node.type !== 'CallExpression') {
          return Effect.void
        }

        const { callee } = node

        if (callee.type === 'Super' || callee.type === 'V8IntrinsicExpression') {
          return Effect.void
        }

        return isGlobalReflectMethodCall(context.sourceCode, callee, METHOD)
          ? context.report(Diagnostic.fromId({ node, messageId: 'reflectGet' }))
          : Effect.void
      },
    }
  },
})
