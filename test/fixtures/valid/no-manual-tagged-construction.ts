const tagged = NotFound.make({ url })
const schema = Schema.Struct({ _tag: Schema.Literal('NotFound'), url: Schema.String })
const tag = Schema.tag('NotFound')
const matched = Match.tags({ NotFound: () => 1 })
const dynamic = { _tag: tagFor(value) }
const { _tag } = value
const label = { tag: 'NotFound' }

type Shape = { readonly _tag: 'Shape' }

interface Other {
  readonly _tag: 'Other'
}

class Plain {
  readonly tag = 'Plain'
}
