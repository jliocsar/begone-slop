const kind = typeof payload
const guarded = typeof payload === 'string'
const negated = typeof payload !== 'object'
const nested = typeof (payload as { id: string }).id
const called = describe(typeof payload)
const templated = `${typeof payload}`
function narrowed(payload) { if (typeof payload === 'number') { return payload } }
const chained = typeof payload === 'string' || typeof payload === 'number'
class Probed { readonly kind = typeof payload }
export const exported = typeof payload
