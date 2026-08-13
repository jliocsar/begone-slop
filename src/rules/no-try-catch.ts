import { Rule } from 'effect-oxlint'

const MESSAGE =
  'try/catch erases the error type and catches failures you never meant to handle. Wrap the throwing call in Effect.try or Effect.tryPromise, or model the failure in the error channel.'

export default Rule.banStatement('TryStatement', {
  message: MESSAGE,
  meta: { type: 'problem' },
})
