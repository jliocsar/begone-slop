import { Context, Effect, Layer } from 'effect'
import * as Other from 'other-library'

export const withLogging = (layer: Layer.Layer<Store>) => layer.pipe(Layer.provide(Logger.layer))
export const merged = (layer: Layer.Layer<Store>): Layer.Layer<Store | Clock> => Layer.merge(layer, Clock.layer)
export const read = Effect.contextWith((context: Context.Context<Store>) => Context.get(context, Store))
export const plain = (name: string, store: StoreShape) => store.load(name)
export const foreign = (layer: Other.Layer<Store>) => layer
