const status = value === 'ready' ? 1 : value === 'failed' ? 2 : 3
const label = kind !== 1 ? 'first' : kind !== 2 ? 'second' : 'other'
const flipped = 'ready' == state ? 1 : 'failed' == state ? 2 : 0
const templated = record.field === `ready` ? 1 : record.field === `failed` ? 2 : 3
const three = tier === 'a' ? 1 : tier === 'b' ? 2 : tier === 'c' ? 3 : 4
const indexed = record['kind'] === 1 ? 'a' : record['kind'] === 2 ? 'b' : 'c'
const typed = typeof value === 'string' ? 1 : typeof value === 'number' ? 2 : 3
const asserted = value! === 'ready' ? 1 : value! === 'failed' ? 2 : 3
