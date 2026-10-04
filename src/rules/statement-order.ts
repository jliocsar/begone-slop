import type { ESTree } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'

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

export default defineRule({
  meta: {
    type: 'layout',
    docs: {
      description:
        'require top-level order: imports > type-defs > constants > functions > variables > modules > exports',
    },
    messages: {
      outOfOrder:
        '"{{section}}" section appears after "{{after}}". Move it up to keep the fixed top-level order.',
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
      },
    }
  },
})
