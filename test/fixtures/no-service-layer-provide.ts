class Payments extends Context.Service<Payments>()('app/Payments', { make }) {
  static readonly layer = Layer.effect(this, this.make).pipe(Layer.provide(FetchHttpClient.layer))
  static readonly layerMerged = Layer.effect(this, this.make).pipe(Layer.provideMerge(Storage.layer))
  static readonly layerDataFirst = Layer.provide(Layer.effect(this, this.make), Storage.layer)
  static readonly layerComputed = Layer.effect(this, this.make).pipe(Layer['provide'](Storage.layer))
  static readonly layerRenamed = Layer.effect(this, this.make).pipe(L.provide(Storage.layer))
  static readonly layerBarrel = Layer.effect(this, this.make).pipe(EffectLayer.provide(Storage.layer))
}
const Orders = class extends Context.Service<Orders, Shape>()('app/Orders') {
  static readonly layer = Layer.succeed(this, shape).pipe(Layer.provide(Storage.layer))
}
class Mailer extends Fx.Service<Mailer>()('app/Mailer', { make }) {
  static readonly layer = Layer.effect(this, this.make).pipe(Layer.provide(Storage.layer))
}

import { Layer as EffectLayer } from 'effect'
import * as Context from 'effect/Context'
import * as Layer from 'effect/Layer'
import * as L from 'effect/Layer'
import { Context as Fx } from 'effect'
