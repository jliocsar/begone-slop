type Value = unknown

type Wrapper<Inner> = unknown

type Shape = { value: unknown }

type Cyclic = Cyclic

function shadowed<Value>(value: Value): Value {
  return value
}

function nested<Value>() {
  return (value: Value): Value => value
}

function generic(): Wrapper<string> {
  return 'a'
}

function bareGeneric(): Wrapper {
  return 'a'
}

function shaped(): { cause: unknown } {
  return { cause: null }
}

function structured(): Shape {
  return { value: null }
}

function cyclic(): Cyclic {
  return null
}

function inferred() {
  return 1
}

function parameterized(input: unknown): string {
  return String(input)
}

function arrayed(): unknown[] {
  return []
}

function resolved(): Promise<string> {
  return Promise.resolve('a')
}

interface Contract {
  method<Value>(): Value
  handler: () => Shape
}
