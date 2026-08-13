/**
 * `Reflect.apply` invokes a function through an untyped argument array, so the
 * arity and parameter types go unchecked. Call the function directly, or put the
 * dynamic dispatch behind a named interface that states what may be called.
 *
 * `Reflect['apply'](…)` is the same call, so the computed form counts too. A
 * local `Reflect` does not — see `shared/reflect-method.ts`.
 *
 * Report-only — the replacement depends on what is being dispatched.
 */

import * as Effect from 'effect/Effect'
import { Diagnostic, type ESTree, Rule, RuleContext } from 'effect-oxlint'
import { isGlobalReflectMethodCall } from '../shared/reflect-method.ts'

const METHOD = 'apply'

const MESSAGE =
  'Replace `Reflect.apply` with a typed function call. Model dynamic dispatch behind a named interface.'

export default Rule.define({
  name: 'no-reflect-apply',
  meta: Rule.meta({
    type: 'problem',
    description: 'forbid Reflect.apply in favour of a typed function call',
    messages: { reflectApply: MESSAGE },
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
          ? context.report(Diagnostic.fromId({ node, messageId: 'reflectApply' }))
          : Effect.void
      },
    }
  },
})
