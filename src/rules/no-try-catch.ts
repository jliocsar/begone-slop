/**
 * A `try` block moves failure out of the type system: nothing records what was
 * thrown, so nothing can check the handler still covers it.
 *
 * Every `TryStatement` counts, `try`/`finally` with no handler included — the
 * body still throws into an untyped channel.
 */

import { Rule } from 'effect-oxlint'

const MESSAGE =
  'Do not use try/catch. Use Effect.try, Effect.tryPromise, or explicit error channels instead.'

export default Rule.banStatement('TryStatement', {
  message: MESSAGE,
  meta: { type: 'problem' },
})
