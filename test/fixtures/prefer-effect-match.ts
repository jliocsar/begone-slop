const status = value === 'ready' ? 1 : value === 'failed' ? 2 : 3
const label = kind !== 1 ? 'first' : kind !== 2 ? 'second' : 'other'
const flipped = 'ready' == state ? 1 : 'failed' == state ? 2 : 0
const templated = record.field === `ready` ? 1 : record.field === `failed` ? 2 : 3
const three = tier === 'a' ? 1 : tier === 'b' ? 2 : tier === 'c' ? 3 : 4
const called = classify(input) === 1 ? 'a' : classify(input) === 2 ? 'b' : 'c'
