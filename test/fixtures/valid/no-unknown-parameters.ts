type Anything = unknown

function enriched(cause: unknown) {}

class Wrapped {
  constructor(private readonly cause: unknown) {}
}

function defaultedCause(cause: unknown = null) {}

function restedCause(...cause: unknown) {}

function aliased(input: Anything) {}

function arrayed(inputs: unknown[]) {}

function promised(input: Promise<unknown>) {}

function unioned(input: string | unknown) {}

function shaped(input: { cause: unknown }) {}

function unannotated(input) {}

function returning(): unknown {
  return 1
}

interface Contract {
  method(input: Anything): void
  handler: (cause: unknown) => void
}
