/**
 * A `switch` is a hand-rolled dispatch that a new variant falls through
 * silently. `Match` is the checked form.
 *
 * Report-only — the replacement depends on what the cases do.
 */

import { Rule } from 'effect-oxlint'

const MESSAGE = 'Switch statements are banned. Use Match from effect.'

export default Rule.banStatement('SwitchStatement', {
  message: MESSAGE,
  meta: { type: 'problem' },
})
