import * as Effect from 'effect/Effect'

const parsed = Effect.try({
  try: () => globalThis.JSON.parse('{}'),
  catch: (cause) => cause,
})
const fetched = Effect.tryPromise({
  try: () => globalThis.fetch('https://example.test'),
  catch: (cause) => cause,
})
const recovered = Effect.catch(parsed, (error) => Effect.succeed(error))
const finallyProperty = { try: 1, catch: 2, finally: 3 }
const inString = 'try { risky() } catch (error) { swallow(error) }'
