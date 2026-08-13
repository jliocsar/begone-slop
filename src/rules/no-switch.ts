import { Rule } from 'effect-oxlint'

const MESSAGE = 'Switch statements are banned. Use Match from effect.'

export default Rule.banStatement('SwitchStatement', {
  message: MESSAGE,
  meta: { type: 'problem' },
})
