import { Array, Array as Arr } from 'effect'
import * as ArrayOps from 'effect/Array'

const piped = pipe(
  values,
  Array.map((value) => value),
  Array.filter((value) => value),
)
const siblingArguments = Array.map(values, transform)
const globalStaticArgument = Array.map(globalThis.Array.from(values), (value) => value)
const typeOnlyImportNesting = TypeOnlyArray.map(TypeOnlyArray.from(values), (value) => value)
const outerIsNotAnArrayCall = identity(Array.from(values))
const referenceWithoutCall = Array.map(values, () => Array.isArray)

function localGlobalAlias() {
  const Array = globalThis.Array

  return Array.from(Array.of(1))
}

import { type Array as TypeOnlyArray } from 'effect'

const seedArgument = ArrayOps.scan(values, ArrayOps.empty<string>(), (prefix, value) => [...prefix, value])
const nonDataArgument = ArrayOps.difference(values, ArrayOps.map(others, (other) => other))
const insideCallback = ArrayOps.map(values, (value) => ArrayOps.of(value))
const insideNestedCallback = ArrayOps.filter(values, (value) => ArrayOps.contains(allowed, value))
const dataLastSeed = pipe(
  values,
  ArrayOps.scan(ArrayOps.empty<string>(), (prefix, value) => [...prefix, value]),
)

import { pipe } from 'effect/Function'
