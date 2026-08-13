const discarded = Effect.asVoid(writeRecord)
const asVoidAlias = Effect.asVoid
const program = pipe(writeRecord, Effect.asVoid)
