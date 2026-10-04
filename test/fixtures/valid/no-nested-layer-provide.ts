import { Layer as EffectLayer } from 'effect'
import * as Layer from 'effect/Layer'

const flatProvide = Layer.provide(base, database)
const combinedInOneCall = Layer.provide(base, [database, config])
const outerIsProvideMerge = Layer.provideMerge(base, Layer.provide(database, config))
const innerIsProvideMerge = Layer.provide(base, Layer.provideMerge(database, config))
const bothAreProvideMerge = Layer.provideMerge(base, Layer.provideMerge(database, config))
const nestedBehindAnotherCall = Layer.provide(base, wrap(Layer.provide(database, config)))
const nestedInsideAnArray = Layer.provide(base, [Layer.provide(database, config)])
const nestedInsideAnArrow = Layer.provide(base, () => Layer.provide(database, config))
const pipeFormIsADifferentRule = base.pipe(Layer.provide(database), Layer.provide(config))
const receiverIsNotEffectLayer = UnrelatedLayer.provide(base, UnrelatedLayer.provide(database, config))
const computedPropertyNames = Layer['provide'](base, Layer['provide'](database, config))
const otherCombinatorOutside = Layer.merge(base, Layer.provide(database, config))
const otherCombinatorInside = Layer.provide(base, Layer.merge(database, config))
const pipeOfOtherCombinators = Layer.provide(base.pipe(Layer.merge(database)))
const notEffectsPipe = Layer.provide(lodashPipe(base, Layer.provide(database)))

function localLookAlike() {
  const Layer = { provide: (value) => value }

  return [1].map(() => Layer.provide(Layer.provide(1)))
}

import { Layer as UnrelatedLayer } from './layers.ts'
import { pipe as lodashPipe } from 'lodash/fp'
