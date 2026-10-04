import type * as O from 'effect/Option'

const Option = { some: wrap, none: empty }

const localLookAlike = value !== null ? Option.some(value) : Option.none()
const typeOnlyImport = value !== null ? O.some(value) : O.none()
