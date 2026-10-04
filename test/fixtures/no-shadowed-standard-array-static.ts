import * as Array from 'effect/Array'
const fromCall = Array.from(values)
const isArrayCall = Array.isArray(values)
const ofCall = Array.of(1, 2)
const staticReference = Array.isArray
const insideCallback = values.map((value) => Array.from(value))

function localGlobalAlias() {
  const Array = globalThis.Array

  return Array.isArray(Array.from([Array.of(1)]))
}
