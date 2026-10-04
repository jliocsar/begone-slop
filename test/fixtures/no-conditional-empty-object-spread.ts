const withValue = { ...(value !== undefined ? { value } : {}) }
const withoutValue = { ...(condition ? {} : { value }) }
const bothEmpty = { ...(condition ? {} : {}) }
const doubleParens = { ...((condition ? { value } : {})) }
const noParens = { ...condition ? { value } : {} }
const nestedObject = { outer: { ...(condition ? { value } : {}) } }
const asserted = { ...(condition ? { value } : ({} as Partial<Shape>)) }
const satisfied = { ...(condition ? { value } : ({} satisfies Partial<Shape>)) }
const nestedEmpty = { ...(condition ? { value } : other ? { fallback } : {}) }
