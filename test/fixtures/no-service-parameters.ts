export const run = (context: Context.Context<Store>) => Effect.provideContext(program, context)
export function boot(runtime: ManagedRuntime.ManagedRuntime<Store, never>) { return runtime.runPromise(program) }
export const start = (layer: Layer.Layer<Store>) => Effect.provide(program, layer)
export type Starter = (layer: Layer.Layer<Store>) => void
export interface Runner { run(context: Context.Context<Store>): void }
export class Host { constructor(private readonly runtime: ManagedRuntime.ManagedRuntime<Store, never>) {} }
export const typeImported = (layer: TypeLayer.Layer<Store>) => Effect.provide(program, layer)
import { Context, Effect, Layer, ManagedRuntime } from 'effect'
import type * as TypeLayer from 'effect/Layer'
