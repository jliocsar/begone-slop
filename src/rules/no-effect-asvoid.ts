import { Rule } from 'effect-oxlint'

const MESSAGE =
  'Effect.asVoid throws away a success value the caller may still want. Return the effect unchanged when its success type is already void.'

export default Rule.banMember('Effect', 'asVoid', {
  message: MESSAGE,
  meta: { type: 'problem' },
})
