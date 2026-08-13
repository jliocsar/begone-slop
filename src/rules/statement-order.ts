import * as Arr from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Predicate from 'effect/Predicate'
import { Diagnostic, type ESTree, Rule, RuleContext } from 'effect-oxlint'

const SECTION_NAMES = [
  'imports',
  'type-defs',
  'constants',
  'functions',
  'variables',
  'modules',
  'exports',
]

const STATIC_RANKS = new Map([
  ['ImportDeclaration', 0],
  ['TSInterfaceDeclaration', 1],
  ['TSEnumDeclaration', 1],
  ['FunctionDeclaration', 3],
  ['TSDeclareFunction', 3],
  ['TSModuleDeclaration', 5],
  ['ExportDefaultDeclaration', 6],
  ['ExportAllDeclaration', 6],
])

const UNWALKED_KEYS = new Set(['parent', 'loc', 'range', 'start', 'end'])

// oxlint-disable-next-line begone-slop/no-unknown-parameters -- walks arbitrary AST fields; oxlint's node types do not model them
function containsTypeQuery(value: unknown): boolean {
  if (Arr.isArray(value)) {
    return value.some(containsTypeQuery)
  }

  if (!Predicate.isObject(value)) {
    return false
  }

  if (value['type'] === 'TSTypeQuery') {
    return true
  }

  return Object.entries(value)
    .filter(([key]) => !UNWALKED_KEYS.has(key))
    .some(([, child]) => containsTypeQuery(child))
}

function rankOf(node: ESTree.Node): Option.Option<number> {
  if (node.type === 'TSTypeAliasDeclaration') {
    return containsTypeQuery(node.typeAnnotation) ? Option.none() : Option.some(1)
  }

  if (node.type === 'VariableDeclaration') {
    return Option.some(node.kind === 'const' ? 2 : 4)
  }

  if (node.type === 'ExportNamedDeclaration') {
    return node.declaration === null || node.declaration === undefined
      ? Option.some(6)
      : rankOf(node.declaration)
  }

  return Option.fromNullishOr(STATIC_RANKS.get(node.type))
}

function outOfOrderDiagnostics(program: ESTree.Node): readonly Diagnostic.Diagnostic[] {
  if (program.type !== 'Program') {
    return []
  }

  const ranked = Arr.getSomes(
    program.body.map((statement) => Option.map(rankOf(statement), (rank) => ({ statement, rank }))),
  )

  const highestBefore = Arr.scan(ranked, -1, (highest, { rank }) => Math.max(highest, rank))

  return Arr.zip(ranked, highestBefore)
    .filter(([{ rank }, highestSeen]) => rank < highestSeen)
    .map(([{ statement, rank }, highestSeen]) =>
      Diagnostic.fromId({
        node: statement,
        messageId: 'outOfOrder',
        data: { section: SECTION_NAMES[rank], after: SECTION_NAMES[highestSeen] },
      }),
    )
}

export default Rule.define({
  name: 'statement-order',
  meta: Rule.meta({
    type: 'layout',
    description:
      'require top-level order: imports > type-defs > constants > functions > variables > modules > exports',
    messages: {
      outOfOrder:
        '"{{section}}" section appears after "{{after}}". Move it up to keep the fixed top-level order.',
    },
  }),
  create: function* () {
    const context = yield* RuleContext

    return {
      Program: (program: ESTree.Node) =>
        Effect.forEach(outOfOrderDiagnostics(program), context.report, { discard: true }),
    }
  },
})
