// Requiring the service is the shape this rule asks for.
const required = Effect.service(CacheService)
const provided = Effect.provide(program, CacheLayer)

// Neighbouring members that merely start the same way.
const services = Effect.serviceOptional(CacheService)
const constant = Effect.serviceConstants(CacheService)

// An aliased import is deliberately out of reach of a purely syntactic check.
const aliasedModule = E.serviceOption(CacheService)

// Some other receiver's member of that name.
const otherReceiver = registry.serviceOption(CacheService)
const bareCall = serviceOption(CacheService)
