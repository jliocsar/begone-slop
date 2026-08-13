const withValue = { ...(value !== undefined ? { value } : {}) }
const withoutValue = { ...(condition ? {} : { value }) }
const bothEmpty = { ...(condition ? {} : {}) }
const doubleParens = { ...((condition ? { value } : {})) }
const noParens = { ...condition ? { value } : {} }
const nestedObject = { outer: { ...(condition ? { value } : {}) } }
