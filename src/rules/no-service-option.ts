/**
 * `Effect.serviceOption` turns a missing service into a runtime `Option`, which
 * hides the wiring gap the layer should have failed on. Require the service and
 * provide it.
 *
 * Purely syntactic: any `Effect.serviceOption` member reference, called or not.
 * An aliased import (`import { Effect as E }`) is deliberately not caught.
 *
 * Report-only — the fix is a layer change, not a local rewrite.
 */

import { Rule } from 'effect-oxlint'

const MESSAGE =
  'Do not use Effect.serviceOption. Require the service directly and provide it in the layer.'

export default Rule.banMember('Effect', 'serviceOption', {
  message: MESSAGE,
  meta: { type: 'problem' },
})
