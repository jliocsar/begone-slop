// Recovery combinators outside the watched set, whatever they return.
Effect.catchAll(program, () => Effect.void)
Effect.catchAllCause(program, () => Effect.void)
Effect.orElse(program, () => Effect.void)
Effect.ignore(program)

// A handler that does something with the error.
Effect.catch(program, () => Effect.succeed(fallback))
Effect.catch(program, (error) => Effect.logError(error))
Effect.catchTag('Timeout', (error) => Effect.fail(error))
Effect.catchReasons({ Corrupted: (error) => Effect.logError(error) })

// More than one statement is a deliberate recovery, not a swallow.
Effect.catch(program, (error) => { log(error); return Effect.void })
Effect.catchTags({ Timeout: (error) => { log(error); return Effect.unit } })

// A block that returns nothing, or never returns at all.
Effect.catch(program, () => { return })
Effect.catch(program, () => { log('caught') })

// `Effect.void` called is a different expression from the value.
Effect.catch(program, () => Effect.void())
Effect.catch(program, () => Effect.never)
Effect.catch(program, () => Effect.voidValue)

// Some other receiver's catch.
Stream.catchTag('Timeout', () => Effect.void)
queue.catch(program, () => Effect.void)
promise.catch(() => Effect.void)
catchTags({ Timeout: () => Effect.void })

// Nothing callable to inspect.
Effect.catchTags({ ...handlers })
Effect.catchTag('Timeout', handler)
const swallow = () => Effect.void
const handlers = { Timeout: () => Effect.void }
