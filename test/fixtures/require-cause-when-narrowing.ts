decode(text).pipe(Effect.mapError(() => BadRequest.make({ reason: 'invalid json' })))
Effect.mapError(decode(text), (_error) => new DialFailed({ message: 'bad frame' }))
read.pipe(Effect.catch(() => Effect.fail(new Unavailable())))
read.pipe(Effect.catchAll(() => Effect.fail(new Unavailable())))
read.pipe(Effect.orElse(() => Effect.gen(function* () { return yield* new Unavailable({ reason: 'down' }) })))
read.pipe(Effect.catchCause(() => { return Effect.fail(Errors.Unavailable.make()) }))
read.pipe(Effect.mapError(() => new Error('read failed')))
read.pipe(Effect.mapError(() => new Failed()), Effect.tapError(Effect.logError))
read.pipe(Effect.catch(() => (stale ? Effect.fail(new Missing()) : Effect.succeed(fallback))))
Fx.mapError(read, () => new Failed())
import { Effect } from 'effect'
import * as Fx from 'effect/Effect'
