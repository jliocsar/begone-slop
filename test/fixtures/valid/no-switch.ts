import * as Match from 'effect/Match'

const classify = Match.type<{ kind: string }>().pipe(
  Match.when({ kind: 'first' }, () => 'one'),
  Match.orElse(() => 'other'),
)
const RANKS = new Map([
  ['first', 1],
  ['second', 2],
])

function rank(kind: string): number {
  if (kind === 'first') {
    return 1
  }

  return RANKS.get(kind) ?? 0
}

const ternary = rank('first') === 1 ? 'one' : 'many'
const switchLike = { switch: 'a property named switch is not a statement' }
const inString = 'switch (value) { case 1: break }'
