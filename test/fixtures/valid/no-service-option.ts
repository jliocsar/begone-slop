import { Effect } from 'effect'

// Requiring the service is the shape this rule asks for.
const required = Effect.service(CacheService)
const provided = Effect.provide(program, CacheLayer)

// Neighbouring members that merely start the same way.
const services = Effect.serviceOptional(CacheService)
const constant = Effect.serviceConstants(CacheService)

// A receiver that is not an import of Effect.
const unimportedReceiver = E.serviceOption(CacheService)
const shadowed = (Effect: Registry) => Effect.serviceOption(CacheService)

// Some other receiver's member of that name.
const otherReceiver = registry.serviceOption(CacheService)
const bareCall = serviceOption(CacheService)
