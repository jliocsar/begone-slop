const bare = program.pipe(Effect.ignore)
const called = Effect.ignore(program)
const cause = program.pipe(Effect.ignoreCause)
const logOff = Effect.ignore(program, { log: false })
const otherOption = Effect.ignore(program, { message: 'quiet' })
const renamed = program.pipe(Fx.ignore())
const computed = Effect['ignore'](program)
const barrel = program.pipe(Renamed.ignoreCause)
import { Effect } from 'effect'
import { Effect as Renamed } from 'effect'
import * as Fx from 'effect/Effect'
