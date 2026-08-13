/**
 * `Effect.asVoid` on an effect that already succeeds with `void` is noise, and
 * on one that does not it discards a value somebody wanted.
 *
 * Purely syntactic: any `Effect.asVoid` member reference, so one sitting inside
 * a `pipe` counts. An aliased import (`import { Effect as E }`) is deliberately
 * not caught.
 *
 * Report-only — dropping the call may mean widening the return type.
 */

import { Rule } from 'effect-oxlint'

const MESSAGE =
  'Avoid Effect.asVoid. Prefer returning the effect directly when the success type is void.'

export default Rule.banMember('Effect', 'asVoid', {
  message: MESSAGE,
  meta: { type: 'problem' },
})
