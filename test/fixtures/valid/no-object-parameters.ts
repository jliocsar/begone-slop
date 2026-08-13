type Alias = object

type Generic<Value> = object

type Mapped = { [Alias in 'a']: (value: Alias) => void }

type Inferred<Value> = Value extends (infer Alias extends (value: Alias) => void) ? Alias : never

function named(input: { id: string }) {}

function recorded(input: Record<string, string>) {}

function generic(input: Generic<string>) {}

function applied(input: Alias<string>) {}

function shadowed<Alias>(input: Alias) {}

function constrained<Value extends object>(input: Value) {}

function unannotated(input) {}

function returning(): object {
  return {}
}

const annotated: object = {}

class Held {
  private readonly held: object = {}
}

interface Contract {
  held: object
  method(input: Alias<string>): void
  handler: (input: { id: string }) => void
}
