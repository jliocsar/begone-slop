import * as Array from 'effect/Array'
import { Array as Arr } from 'effect'
import * as ArrayOps from 'effect/Array'

const standard = globalThis.Array.from(values)
const alsoStandard = globalThis.Array.isArray(values)
const notAStandardStatic = Array.fromAsync(values)
const effectModuleMethod = Array.map(values, (value) => value)
const computedAccess = Array['from']
const aliasedBarrelBinding = Arr.from(values)
const aliasedLeafBinding = ArrayOps.from(values)
const unrelatedReceiver = helpers.Array.of(1)
