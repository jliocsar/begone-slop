import { Effect, Predicate } from 'effect'
import * as Other from 'other-library'

const isNotFound = Predicate.isTagged('NotFound')
const isTagged = (value: Tagged) => value.kind === 'x'

load.pipe(Effect.catchTag('NotFound', () => Effect.succeed(fallback)))
load.pipe(Effect.catchTag('NotFound', (error) => Effect.succeed(Predicate.isTagged(error, 'NotFound'))))
decode(input).pipe(Effect.map((value) => Predicate.isTagged(value, 'Ok')))
load.pipe(Effect.catch((error) => Effect.fail(error)))
load.pipe(Effect.catch((error) => Effect.succeed(isTagged(error))))
Other.catch(load, (error) => Predicate.isTagged(error, 'X'))
