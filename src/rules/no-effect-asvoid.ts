import { Rule } from 'effect-oxlint'

const MESSAGE =
  'Avoid Effect.asVoid. Prefer returning the effect directly when the success type is void.'

export default Rule.banMember('Effect', 'asVoid', {
  message: MESSAGE,
  meta: { type: 'problem' },
})
