import type { ESTree, SourceCode } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import {
  exportedScreamingConst,
  isScreamingConstDeclaration,
} from '../shared/screaming-constant.ts'

type TopLevelNode = ESTree.Declaration | ESTree.Directive | ESTree.Statement

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
  ['TSEnumDeclaration', 2],
  ['FunctionDeclaration', 3],
  ['TSDeclareFunction', 3],
  ['TSModuleDeclaration', 5],
  ['ExportDefaultDeclaration', 6],
  ['ExportAllDeclaration', 6],
])

function aliasAnnotatedBy(node: ESTree.Node): ESTree.TSTypeAliasDeclaration | undefined {
  const { parent } = node

  if (parent === null) {
    return undefined
  }

  if (parent.type === 'TSTypeAliasDeclaration') {
    return parent.typeAnnotation === node ? parent : undefined
  }

  return aliasAnnotatedBy(parent)
}

function rankOf(
  typeQueryAliases: ReadonlySet<ESTree.TSTypeAliasDeclaration>,
  node: TopLevelNode,
): number | undefined {
  if (node.type === 'TSTypeAliasDeclaration') {
    return typeQueryAliases.has(node) ? undefined : 1
  }

  if (node.type === 'VariableDeclaration') {
    return node.kind === 'const' ? 2 : 4
  }

  if (node.type === 'ExportNamedDeclaration') {
    return node.declaration === null || node.declaration === undefined
      ? 6
      : rankOf(typeQueryAliases, node.declaration)
  }

  return STATIC_RANKS.get(node.type)
}

function readsAnyOf(
  sourceCode: SourceCode,
  statement: ESTree.Node,
  declarations: readonly ESTree.VariableDeclaration[],
): boolean {
  const [statementStart, statementEnd] = statement.range

  return declarations
    .flatMap((declaration) => sourceCode.getDeclaredVariables(declaration))
    .some((variable) =>
      variable.references.some(
        ({ identifier }) =>
          identifier.range[0] >= statementStart && identifier.range[1] <= statementEnd,
      ),
    )
}

function privateConstantsAfterExports(
  sourceCode: SourceCode,
  body: readonly TopLevelNode[],
): readonly ESTree.Node[] {
  const misplaced: ESTree.Node[] = []
  let exportedInGroup: ESTree.VariableDeclaration[] = []

  for (const statement of body) {
    const exported = exportedScreamingConst(statement)

    if (exported !== undefined) {
      exportedInGroup.push(exported)
    } else if (isScreamingConstDeclaration(statement)) {
      if (exportedInGroup.length > 0 && !readsAnyOf(sourceCode, statement, exportedInGroup)) {
        misplaced.push(statement)
      }
    } else {
      exportedInGroup = []
    }
  }

  return misplaced
}

export default defineRule({
  meta: {
    type: 'layout',
    docs: {
      description:
        'require top-level order: imports > type-defs > constants > functions > variables > modules > exports, with private SCREAMING_CASE constants above exported ones',
    },
    messages: {
      outOfOrder:
        '"{{section}}" section appears after "{{after}}". Move it up to keep the fixed top-level order.',
      privateConstantAfterExport:
        'Module-private constant after an exported one. Move it above the exported constants.',
    },
  },
  create(context) {
    const typeQueryAliases = new Set<ESTree.TSTypeAliasDeclaration>()

    return {
      TSTypeQuery(node) {
        const alias = aliasAnnotatedBy(node)

        if (alias !== undefined) {
          typeQueryAliases.add(alias)
        }
      },
      'Program:exit'(program) {
        let highestSeen = -1

        for (const statement of program.body) {
          const rank = rankOf(typeQueryAliases, statement)

          if (rank === undefined) {
            continue
          }

          if (rank < highestSeen) {
            context.report({
              node: statement,
              messageId: 'outOfOrder',
              data: { section: SECTION_NAMES[rank], after: SECTION_NAMES[highestSeen] },
            })
          }

          highestSeen = Math.max(highestSeen, rank)
        }

        for (const statement of privateConstantsAfterExports(context.sourceCode, program.body)) {
          context.report({ node: statement, messageId: 'privateConstantAfterExport' })
        }
      },
    }
  },
})
