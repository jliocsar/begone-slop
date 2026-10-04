import * as Array from 'effect/Array'
const nestedArgument = Array.map(Array.from(values), (value) => value)
const nestedInArrow = Array.map(values, (value) => Array.of(value))
const nestedInObject = Array.map(values, (value) => ({ items: Array.of(value) }))
const nestedInCall = Array.map(values, (value) => identity(Array.of(value)))
const renamedNamespace = Arr.map(Arr.filter(values, isPositive), (value) => value + 1)
const renamedBarrel = EffectArray.map(EffectArray.fromIterable(values), (value) => value)
const mixedBindings = Array.map(EffectArray.of(value), (value) => value)

import * as Arr from 'effect/Array'
import { Array as EffectArray } from 'effect'
const emptyAsData = Arr.append(Arr.empty<number>(), 1)
const nestedDeeperInData = Arr.map(identity(Arr.of(1)), (value) => value)
