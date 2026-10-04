const nestedInSecondArgument = Layer.provide(base, Layer.provide(database, config))
const nestedInFirstArgument = Layer.provide(Layer.provide(database, config), base)
const twoNestedArgumentsReportTwice = Layer.provide(Layer.provide(database, config), Layer.provide(tracing, metrics))
const nestedTwiceOverReportsBothLevels = Layer.provide(base, Layer.provide(database, Layer.provide(config, tracing)))
const insideAnArrowFunction = () => Layer.provide(base, Layer.provide(database, config))

function nestedInsideAFunction() {
  return Layer.provide(base, Layer.provide(database, config))
}
const renamedNamespace = L.provide(L.provide(base, database), config)
const renamedBarrel = EffectLayer.provide(base, EffectLayer.provide(database, config))
const nestedThroughMethodPipe = Layer.provide(base.pipe(Layer.provide(database)))
const nestedThroughPipeInsidePipe = app.pipe(Layer.provide(base.pipe(L.provide(database))))
const nestedThroughStandalonePipe = Layer.provide(pipe(base, Layer.provide(database)))

import * as Layer from 'effect/Layer'
import * as L from 'effect/Layer'
import { Layer as EffectLayer, pipe } from 'effect'
