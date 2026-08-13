import * as Array from 'effect/Array'
const nestedArgument = Array.map(Array.from(values), (value) => value)
const nestedInArrow = Array.map(values, (value) => Array.of(value))
const nestedInObject = Array.map(values, (value) => ({ items: Array.of(value) }))
const nestedInCall = Array.map(values, (value) => identity(Array.of(value)))
