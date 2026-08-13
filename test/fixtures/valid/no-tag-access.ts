// Defining a tag is not reading one.
const defined = { _tag: 'Manual' }
const renamedKey = { _tag: variant }

class Hand {
  constructor() {
    this._tag = 'Manual'
  }
}

// Type positions are declarations, not reads.
type Shape = { readonly _tag: 'Manual' }
interface Contract {
  readonly _tag: string
}

// A computed access through a variable names nothing resolvable here.
const throughVariable = error[tagKey]
const throughOtherLiteral = error['tag']

// A different property that merely starts the same way.
const notTheTag = error._tagName
const alsoNot = error.tag

// Shorthand in an object literal builds a value; it does not destructure one.
const rebuilt = { _tag }

// The library guards this rule points at.
const matched = Match.value(error).pipe(Match.tag('NotFound', () => 1))
const guarded = Exit.isFailure(exit)
const byInstance = error instanceof NotFound
