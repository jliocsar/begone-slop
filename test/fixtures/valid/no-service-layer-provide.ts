import * as Context from 'effect/Context'
import * as Layer from 'effect/Layer'

class Payments extends Context.Service<Payments>()('app/Payments', { make }) {
  static readonly layer = Layer.effect(this, this.make)
}

class Profiles extends Context.Service<Profiles>()('app/Profiles', { make }) {
  static readonly layerAt = (root: string) =>
    Layer.effect(this, this.make).pipe(Layer.provide(Root.layerFrom(root)))

  static readonly layerFrom = function (root: string) {
    return Layer.effect(this, this.make).pipe(Layer.provide(Root.layerFrom(root)))
  }

  static layerTest() {
    return Layer.effect(this, this.make).pipe(Layer.provide(Root.layerFrom('/tmp')))
  }

  readonly instanceLayer = Layer.effect(Profiles, make).pipe(Layer.provide(Root.layer))
}

class Plain extends Base {
  static readonly layer = Layer.effect(this, make).pipe(Layer.provide(Storage.layer))
}

class Other extends Elsewhere.Service<Other>()('app/Other') {
  static readonly layer = Layer.effect(this, make).pipe(Layer.provide(Storage.layer))
}

class NotLayer extends Context.Service<NotLayer>()('app/NotLayer') {
  static readonly layer = Layer.effect(this, make).pipe(Stream.provide(Storage.layer))
}

const PaymentsLayer = Payments.layer.pipe(Layer.provide(FetchHttpClient.layer))
