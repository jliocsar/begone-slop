const nestedInSecondArgument = Layer.provide(base, Layer.provide(database, config))
const nestedInFirstArgument = Layer.provide(Layer.provide(database, config), base)
const twoNestedArgumentsReportTwice = Layer.provide(Layer.provide(database, config), Layer.provide(tracing, metrics))
const nestedTwiceOverReportsBothLevels = Layer.provide(base, Layer.provide(database, Layer.provide(config, tracing)))
const insideAnArrowFunction = () => Layer.provide(base, Layer.provide(database, config))

function nestedInsideAFunction() {
  return Layer.provide(base, Layer.provide(database, config))
}
