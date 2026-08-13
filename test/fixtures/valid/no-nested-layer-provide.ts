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
const receiverIsNotNamedLayer = EffectLayer.provide(base, EffectLayer.provide(database, config))
const computedPropertyNames = Layer['provide'](base, Layer['provide'](database, config))
const otherCombinatorOutside = Layer.merge(base, Layer.provide(database, config))
const otherCombinatorInside = Layer.provide(base, Layer.merge(database, config))
