const discarded = Effect.asVoid(writeRecord)
const asVoidAlias = Effect.asVoid
const program = pipe(writeRecord, Effect.asVoid)
import { Effect } from 'effect'
import { Effect as Renamed } from 'effect'
import * as Fx from 'effect/Effect'
const renamedBarrel = Renamed.asVoid(writeRecord)
const renamedNamespace = Fx.asVoid(writeRecord)
const computed = Effect['asVoid'](writeRecord)
const optional = Effect?.asVoid(writeRecord)
