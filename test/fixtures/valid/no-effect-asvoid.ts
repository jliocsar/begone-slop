import { Effect } from 'effect'
import * as Stream from 'effect/Stream'

const neighbouringCombinator = Effect.asVoidLater(writeRecord)
const anotherModule = Stream.asVoid(writeRecord)
const namedProperty = { asVoid: true }
const readFromAValue = program.asVoid
const unimportedReceiver = E.asVoid(writeRecord)
const computedNeighbour = Effect['asVoidLater'](writeRecord)
const dynamicMember = Effect[member](writeRecord)
const shadowed = (Effect: Recorder) => Effect.asVoid(writeRecord)
