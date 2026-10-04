import type * as Fx from 'effect/Effect'

const Effect = { catch: recover, void: nothing }

Effect.catch(program, () => Effect.void)
Effect['catch'](program, () => Effect['void'])
Fx.catch(program, () => Fx.void)
