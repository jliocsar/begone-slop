/**
 * A pipeline past this length is unreadable and unnameable: nothing in it says
 * what any stretch of it does. Splitting it into named steps puts those names
 * back.
 *
 * Method form only (`x.pipe(...)`) — a standalone `pipe(a, b, ...)` call is
 * untouched, matching the rule this was ported from.
 *
 * Report-only — where the split belongs is the author's call.
 */

import * as Effect from 'effect/Effect'
import { Diagnostic, type ESTree, Rule, RuleContext } from 'effect-oxlint'

const PIPE_PROPERTY = 'pipe'

/** Not configurable: one number everywhere is what makes it reviewable. */
const MAXIMUM_PIPE_ARGUMENTS = 20

const MESSAGE = 'This pipe has too many arguments. Split it into smaller named steps.'

function isOversizedPipeCall(node: ESTree.CallExpression): boolean {
  const { callee } = node

  return (
    callee.type === 'MemberExpression' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === PIPE_PROPERTY &&
    node.arguments.length > MAXIMUM_PIPE_ARGUMENTS
  )
}

export default Rule.define({
  name: 'pipe-max-arguments',
  meta: Rule.meta({
    type: 'problem',
    description: 'forbid a `.pipe()` call with more than 20 arguments',
    messages: { pipeMaxArguments: MESSAGE },
  }),
  create: function* () {
    const context = yield* RuleContext

    return {
      CallExpression: (node: ESTree.Node) =>
        node.type === 'CallExpression' && isOversizedPipeCall(node)
          ? context.report(Diagnostic.fromId({ node, messageId: 'pipeMaxArguments' }))
          : Effect.void,
    }
  },
})
