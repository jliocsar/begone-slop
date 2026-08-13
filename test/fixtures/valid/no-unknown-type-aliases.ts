import type { Mystery } from './mystery.ts'

// An imported alias is unresolvable here.
type Imported = Mystery

// A union has other members: `unknown` in it is not a disguise.
type Loose = unknown | string
type AlsoLoose = string | unknown

// `unknown` under a constructor is not the alias's resolved type.
type Boxed = Promise<unknown>
type Listed = unknown[]
type Held = { readonly value: unknown }
type Produced = () => unknown
type Accepted = (value: unknown) => string
type Indexed = Record<string, unknown>

// An applied generic resolves to its argument, not to the alias body.
type Applied<Value> = Value
type Uses = Applied<unknown>
type Identity<Value> = Value
type StillApplied = Identity<Mystery>

// Cycles resolve to nothing at all.
type Cycle = Cycle
type Ping = Pong
type Pong = Ping

type Plain = string
type Chained = Plain

interface Shape {
  readonly value: unknown
}

function scoped() {
  type Inner = unknown
  type Outer = Inner

  return null as Outer
}

namespace Nested {
  export type Buried = unknown
}
