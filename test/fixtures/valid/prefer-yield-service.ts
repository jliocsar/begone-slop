import { Effect } from 'effect'

const program = Effect.gen(function* () {
  const store = yield* Store
  return yield* store.load()
})

const inspected = Effect.gen(function* () {
  const context = yield* Effect.context<Store>()
  return describe(context)
})

const unrelated = Effect.gen(function* () {
  const context = yield* Effect.context<Store>()
  return yield* nested.pipe(Effect.provide(Store.layer), Effect.tap(() => log(context)))
})
