import * as E from 'effect/Effect'

const aliasedModule = E.asVoid(writeRecord)
const neighbouringCombinator = Effect.asVoidLater(writeRecord)
const anotherModule = Stream.asVoid(writeRecord)
const namedProperty = { asVoid: true }
const readFromAValue = program.asVoid
