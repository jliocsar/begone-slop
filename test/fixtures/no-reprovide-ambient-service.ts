const program = Effect.gen(function* () {
  const store = yield* Store
  return yield* nested.pipe(Effect.provideService(Store, store))
})
const dataFirst = Effect.gen(function* () {
  const clock = yield* Clock.Clock
  return yield* Effect.provideService(nested, Clock.Clock, clock)
})
import { Effect } from 'effect'
