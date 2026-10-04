const alpha = value as string
const beta = <string>value
const gamma = /* NOTE: a plain comment is not a justification */ value as string
const delta = { field: value as string }
const epsilon = value as string // SAFETY: a trailing comment comes after the assertion
/**
 * SAFETY: a header comment justifies nothing inside the body
 */
export function lambda() {
  if ((value as string).length > 0) {
    return 1
  }
  while ((value as number) > 0) {
    break
  }
  for (const item of value as string[]) {
    consume(item)
  }
  return 0
}
const mu = /* see SAFETY: a marker after other text is not a justification */ value as string
