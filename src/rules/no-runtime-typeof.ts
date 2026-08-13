/**
 * A `typeof` check reads the runtime representation of a value it never
 * parsed: it says the bits look like a string, not that the value satisfies
 * any contract. Decode at the I/O boundary and branch on the domain value.
 *
 * Every `typeof` operator counts — there is no allowlist and no test-file
 * exemption. `typeof x` in TYPE position is a `TSTypeQuery`, a different node,
 * and is untouched.
 *
 * Report-only — the replacement is the schema the value should have been
 * parsed with, which only the author has.
 */

import * as Effect from 'effect/Effect'
import { Diagnostic, type ESTree, Rule, RuleContext } from 'effect-oxlint'

const TYPEOF_OPERATOR = 'typeof'

const MESSAGE =
  'A `typeof` check narrows a representation without establishing its contract. Parse input at its I/O boundary, then branch on the domain value.'

export default Rule.define({
  name: 'no-runtime-typeof',
  meta: Rule.meta({
    type: 'problem',
    description: 'forbid runtime typeof checks on values that were never parsed',
    messages: { runtimeTypeof: MESSAGE },
  }),
  create: function* () {
    const context = yield* RuleContext

    return {
      UnaryExpression: (node: ESTree.Node) =>
        node.type === 'UnaryExpression' && node.operator === TYPEOF_OPERATOR
          ? context.report(Diagnostic.fromId({ node, messageId: 'runtimeTypeof' }))
          : Effect.void,
    }
  },
})
