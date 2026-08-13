import { Rule } from 'effect-oxlint'

const MESSAGE =
  'Do not use try/catch. Use Effect.try, Effect.tryPromise, or explicit error channels instead.'

export default Rule.banStatement('TryStatement', {
  message: MESSAGE,
  meta: { type: 'problem' },
})
