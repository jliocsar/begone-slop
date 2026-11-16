import { Chunk, Effect } from 'effect'
import * as Other from 'other-library'

decode(text).pipe(Effect.mapError((cause) => BadRequest.make({ reason: 'invalid json', cause })))
decode(text).pipe(Effect.mapError((error) => new BadRequest({ reason: error.message })))
decode(text).pipe(Effect.mapError(() => BadRequest.make({ reason: 'invalid json', ...details })))
decode(text).pipe(Effect.mapError(({ message }) => new BadRequest({ reason: message })))
decode(text).pipe(Effect.mapError(() => new Error('failed', { cause: original })))
decode(text).pipe(Effect.tapError(Effect.logError), Effect.mapError(() => new BadRequest()))
read.pipe(Effect.tapError(Effect.logError)).pipe(Effect.map(parse), Effect.mapError(() => new Failed()))
Effect.mapError(Effect.tapErrorCause(read, Effect.logError), () => new Failed())
load.pipe(Effect.catchTag('NotFound', () => Effect.fail(new Missing())))
load.pipe(Effect.orElse(() => Effect.succeed(new Fallback())))
load.pipe(Effect.catch(() => Effect.sync(() => new Fallback())))
load.pipe(Effect.mapError(() => Chunk.make(1)))
load.pipe(Effect.mapError(() => buildError()))
Other.mapError(load, () => new Failed())
