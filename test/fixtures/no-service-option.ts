const maybeCache = Effect.serviceOption(CacheService)
const serviceOptionAlias = Effect.serviceOption
const program = pipe(Effect.serviceOption(CacheService), Effect.map(useIt))
