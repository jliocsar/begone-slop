const named = value as Config
const constant = value as const
const bracketed = <Config>value
const satisfied = value satisfies unknown
const applied = parse<unknown>(payload)
declare let loose: any
type Holder = { readonly value: unknown }
function widen(input: unknown) {
  return input
}
