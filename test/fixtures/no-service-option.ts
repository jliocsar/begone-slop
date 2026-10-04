const maybeCache = Effect.serviceOption(CacheService)
const serviceOptionAlias = Effect.serviceOption
const program = pipe(Effect.serviceOption(CacheService), Effect.map(useIt))
import { Effect } from 'effect'
import { Effect as Renamed } from 'effect'
import * as Fx from 'effect/Effect'
const renamedBarrel = Renamed.serviceOption(CacheService)
const renamedNamespace = Fx.serviceOption(CacheService)
const computed = Effect['serviceOption']
