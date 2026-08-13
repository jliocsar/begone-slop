import { Rule } from 'effect-oxlint'

const MESSAGE =
  'Do not use Effect.serviceOption. Require the service directly and provide it in the layer.'

export default Rule.banMember('Effect', 'serviceOption', {
  message: MESSAGE,
  meta: { type: 'problem' },
})
