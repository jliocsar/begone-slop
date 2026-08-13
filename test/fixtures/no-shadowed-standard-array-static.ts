import * as Array from 'effect/Array'
const fromCall = Array.from(values)
const isArrayCall = Array.isArray(values)
const ofCall = Array.of(1, 2)
const staticReference = Array.isArray
const insideCallback = values.map((value) => Array.from(value))
