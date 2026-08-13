import { Layer as EffectLayer } from 'effect'
import * as Layer from 'effect/Layer'

const houseNamespaceForm = base.pipe(Layer.provide(database), Layer.provide(config))
const barrelImportForm = base.pipe(EffectLayer.provide(database), EffectLayer.provide(config))
const mixedImportForms = base.pipe(Layer.provide(database), EffectLayer.provideMerge(config))
const provideMergeStages = base.pipe(Layer.provideMerge(database), Layer.provideMerge(config))
const computedMethodNames = base.pipe(Layer['provide'](database), Layer['provideMerge'](config))
const threeStagesReportOnce = base.pipe(
  Layer.provide(database),
  Layer.provide(config),
  Layer.provideMerge(tracing),
)
const stagesAmongOtherArguments = base.pipe(Layer.map(identity), Layer.provide(database), Layer.provide(config))
const chainedPipeReportsEachCall = base.pipe(Layer.provide(database), Layer.provide(config)).pipe(EffectLayer.provide(tracing), EffectLayer.provide(metrics))

function nestedScopeStillResolves() {
  return base.pipe(Layer.provide(database), Layer.provide(config))
}
