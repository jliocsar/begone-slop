import type { Effect as TypeOnly } from 'effect'

const Effect = { serviceOption: 2 }

const localLookAlike = Effect.serviceOption
const computedLookAlike = Effect['serviceOption']
const typeOnlyImport = TypeOnly.serviceOption
