load.pipe(Effect.catch((error) => (Predicate.isTagged(error, 'NotFound') ? Effect.succeed(fallback) : Effect.fail(error))))
load.pipe(Effect.catchIf(Predicate.isTagged('NotFound'), () => Effect.succeed(fallback)))
load.pipe(Effect.catchCause((cause) => Effect.gen(function* () { return Predicate.isTagged(cause, 'Interrupt') ? yield* recover : yield* Effect.failCause(cause) })))
Effect.catch(load, (error) => Effect.sync(() => Predicate.isTagged(error.reason, 'Timeout')))
load.pipe(Effect.catch((error) => Effect.succeed(P.isTagged('NotFound')(error))))
import { Effect, Predicate } from 'effect'
import * as P from 'effect/Predicate'
