const program = Effect.gen(function* () {
  const context = yield* Effect.context<Store>()
  return yield* nested.pipe(Effect.provide(context))
})
const layer = Layer.effectContext(Effect.gen(function* () {
  const services = yield* Effect.context<Store | Clock>()
  return yield* Effect.provideContext(nested, services)
}))
const succeeded = Effect.gen(function* () {
  const captured = yield* Effect.context<Store>()
  return Layer.succeedContext(captured)
})
import { Effect, Layer } from 'effect'
