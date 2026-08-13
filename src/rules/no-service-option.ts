import { Rule } from 'effect-oxlint'

const MESSAGE =
  'Effect.serviceOption turns a missing dependency into a runtime Option the type system stops tracking. Require the service directly and supply it when building the layer.'

export default Rule.banMember('Effect', 'serviceOption', {
  message: MESSAGE,
  meta: { type: 'problem' },
})
