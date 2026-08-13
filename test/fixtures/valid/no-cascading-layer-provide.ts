import { Layer as EffectLayer } from 'effect'
import { Layer as UnrelatedLayer } from './layers.ts'
import * as Effect from 'effect/Effect'
import * as Layer from 'effect/Layer'

const singleStage = base.pipe(Layer.provide(database))
const singleBarrelStage = base.pipe(EffectLayer.provide(database))
const otherLayerCombinators = base.pipe(Layer.merge(database), Layer.mergeAll(config))
const oneStageAmongOthers = base.pipe(Layer.map(identity), Layer.provide(database), Layer.orDie)
const methodChainingIsOneArgument = base.pipe(Layer.provide(database).provide(config))
const methodChainingWithoutPipe = base.provide(database).provide(config)
const standalonePipeFunction = pipe(base, Layer.provide(database), Layer.provide(config))
const notAnEffectImport = base.pipe(UnrelatedLayer.provide(database), UnrelatedLayer.provide(config))
const anotherEffectModule = base.pipe(Effect.provide(database), Effect.provide(config))
const combinedInOneCall = base.pipe(Layer.provide([database, config]))

function localBindingWins(Layer) {
  return base.pipe(Layer.provide(database), Layer.provide(config))
}

function blockScopedShadow() {
  const Layer = buildLayer()

  return base.pipe(Layer.provide(database), Layer.provide(config))
}
