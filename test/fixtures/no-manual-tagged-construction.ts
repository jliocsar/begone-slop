const notFound = { _tag: 'NotFound', url }
const quoted = { '_tag': 'NotFound' }
const computed = { ['_tag']: 'NotFound' }
const asserted = { _tag: 'NotFound' as const }
const templated = { _tag: `NotFound` }
class Missing { readonly _tag = 'Missing' }
class Declared { declare readonly _tag: 'Declared' }
const returned = () => ({ _tag: 'Done', value })
