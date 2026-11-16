import { Context, Effect, Layer } from 'effect'

class Profiles extends Context.Service<Profiles>()('app/Profiles', { make }) {
  static readonly layer = Layer.effect(this, this.make)
}

class Curried extends Context.Service<Curried>()('app/Curried', { make }) {
  static readonly layer = Layer.effect(this)(this.make)
}

class Plain extends Context.Service<Plain, Shape>()('app/Plain') {
  static readonly layer = Layer.sync(this, () => shape)
}

class Bare extends Context.Service<Bare, Shape>()('app/Bare') {}

class WithOptions extends Context.Service<WithOptions>()('app/WithOptions', { make }) {
  static layer(settings: Settings) {
    return Layer.effect(this, this.make)
  }
}

class NotService extends Base {
  static make = Effect.succeed(1)
}
