import { Context, Effect } from 'effect'

const findById = Effect.fn('Users.findById')(function* (id: string) {
  return id
})

class Users extends Context.Service<Users>()('app/Users', {
  make: Effect.gen(function* () {
    const repo = yield* Repo

    return {
      findById,
      list: Effect.fn('Users.list')(function* () {
        return yield* repo.all()
      }),
      count: repo.count().pipe(Effect.withSpan('Users.count')),
      format: (user: User) => user.name,
      remove: (id: string) => repo.remove(id).pipe(Effect.withSpan('Users.remove')),
      settings: { pageSize: 20 },
    }
  }),
}) {}

class Accounts extends Context.Service<Accounts>()('app/Accounts') {
  static readonly make = Effect.gen(function* () {
    return { open: Effect.fn(`Accounts.open`)(function* () {}) }
  })
}

class Plain extends Base {
  static make = Effect.gen(function* () {
    return { list: Effect.succeed([]) }
  })
}
