import { Context, Effect } from 'effect'

const unnamed = Effect.fn(function* (id: string) { return id })

class Users extends Context.Service<Users>()('app/Users', {
  make: Effect.gen(function* () {
    const repo = yield* Repo
    return {
      findById: (id: string) => repo.find(id).pipe(Effect.map(toUser)),
      list: Effect.gen(function* () { return yield* repo.all() }),
      unnamed,
      remove: (id: string) => Effect.gen(function* () { yield* repo.remove(id) }),
      untraced: Effect.fnUntraced(function* () { return 1 }),
    }
  }),
}) {}
