import { Effect } from 'effect'

const crossed = Effect.gen(function* () {
  const store = yield* Store
  return yield* nested.pipe(Effect.provideService(Cache, store))
})

const scoped = Effect.gen(function* () {
  const tenant = yield* Tenant
  return yield* nested.pipe(Effect.provideService(Store, makeStore(tenant)))
})

const fresh = nested.pipe(Effect.provideService(Store, liveStore))

const reassigned = Effect.gen(function* () {
  let store = yield* Store
  store = wrap(store)
  return yield* nested.pipe(Effect.provideService(Store, store))
})
