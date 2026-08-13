import { Rule } from 'effect-oxlint'

const MESSAGE =
  'A switch falls through silently and never reports a missing case. Use Match from Effect, which can be made exhaustive.'

export default Rule.banStatement('SwitchStatement', {
  message: MESSAGE,
  meta: { type: 'problem' },
})
