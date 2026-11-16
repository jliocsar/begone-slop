class Profiles extends Context.Service<Profiles>()('app/Profiles', { make }) {}
class Store extends Context.Service<Store>()('app/Store', { make: Effect.gen(function* () { return {} }) }) { static readonly layerLive = Layer.effect(this, this.make) }
const Mailer = class extends Context.Service<Mailer, Shape>()('app/Mailer') { static readonly make = Effect.succeed(shape) }
import { Context, Effect, Layer } from 'effect'
