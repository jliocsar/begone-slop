import { Array, Array as Arr } from 'effect'
import * as ArrayOps from 'effect/Array'

const piped = pipe(
  values,
  Array.map((value) => value),
  Array.filter((value) => value),
)
const siblingArguments = Array.map(values, transform)
const globalStaticArgument = Array.map(globalThis.Array.from(values), (value) => value)
const aliasedBarrelNesting = Arr.map(Arr.from(values), (value) => value)
const aliasedLeafNesting = ArrayOps.map(ArrayOps.from(values), (value) => value)
const outerIsNotAnArrayCall = identity(Array.from(values))
const referenceWithoutCall = Array.map(values, () => Array.isArray)
