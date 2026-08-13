const alpha = value as const
const beta = <const>value
const gamma = value satisfies string
// SAFETY: the schema validated this field before it reached here
const delta = value as string
const epsilon = /* SAFETY: the caller checked the discriminant */ value as string
// SAFETY: both fields come from the same validated payload
const zeta = { first: value as string, second: value as number }
function readEta() {
  // SAFETY: the entry was inserted directly above
  return cache.get(key) as string
}
function throwTheta() {
  // SAFETY: the payload has this shape by construction
  throw new Error(value as string)
}
function callIota() {
  // SAFETY: the handler only runs for the checked branch
  consume(value as string)
}
class Kappa {
  // SAFETY: the constructor assigns it before any read
  field = value as string
}
