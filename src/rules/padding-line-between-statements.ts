import type { Diagnostic, ESTree, Options, Range, SourceCode } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { isBlockLike } from '../shared/block-like.ts'
import {
  adjacentPairs,
  blankLinesBetween,
  fenceAnchor,
  lineBreakOf,
  lineStartRange,
  statementsOf,
} from '../shared/source-position.ts'
import {
  exportedScreamingConst,
  isScreamingConstDeclaration,
} from '../shared/screaming-constant.ts'

interface SpecOption {
  readonly blankLine: BlankLine
  readonly prev: StatementType | readonly StatementType[]
  readonly next: StatementType | readonly StatementType[]
}

interface Spec {
  readonly blankLine: BlankLine
  readonly prev: readonly StatementType[]
  readonly next: readonly StatementType[]
}

const STATEMENT_TYPES = [
  '*',
  'return',
  'block-like',
  'function',
  'class',
  'import',
  'singleline-const',
  'singleline-let',
  'screaming-const',
  'exported-screaming-const',
] as const

type StatementType = (typeof STATEMENT_TYPES)[number]

const BLANK_LINES = ['always', 'never', 'any'] as const

type BlankLine = (typeof BLANK_LINES)[number]

const STATEMENT_TYPE_SCHEMA = { enum: [...STATEMENT_TYPES] }

const STATEMENT_TYPES_SCHEMA = {
  anyOf: [STATEMENT_TYPE_SCHEMA, { type: 'array', items: STATEMENT_TYPE_SCHEMA }],
}

const SPECS_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      blankLine: { enum: [...BLANK_LINES] },
      prev: STATEMENT_TYPES_SCHEMA,
      next: STATEMENT_TYPES_SCHEMA,
    },
    required: ['blankLine', 'prev', 'next'],
  },
}

const ONLY_WHITESPACE = /^\s*$/u

const STATEMENT_MATCHERS = {
  '*': () => true,
  return: (node) => node.type === 'ReturnStatement',
  'block-like': isBlockLike,
  function: (node) => node.type === 'FunctionDeclaration' || node.type === 'TSDeclareFunction',
  class: (node) => node.type === 'ClassDeclaration',
  import: (node) => node.type === 'ImportDeclaration' || node.type === 'TSImportEqualsDeclaration',
  'singleline-const': (node) => isSingleLineDeclaration(node, 'const'),
  'singleline-let': (node) => isSingleLineDeclaration(node, 'let'),
  'screaming-const': (_declaration, statement) => isScreamingConstDeclaration(statement),
  'exported-screaming-const': (_declaration, statement) =>
    exportedScreamingConst(statement) !== undefined,
} satisfies Record<StatementType, (declaration: ESTree.Node, statement: ESTree.Node) => boolean>

function configuredSpecs(options: Readonly<Options>): readonly Spec[] {
  // SAFETY: oxlint validates configured options against meta.schema before create runs
  const configured = options[0] as readonly SpecOption[] | undefined

  return (configured ?? []).map(({ blankLine, prev, next }) => ({
    blankLine,
    prev: [prev].flat(),
    next: [next].flat(),
  }))
}

function isSingleLineDeclaration(node: ESTree.Node, kind: 'const' | 'let'): boolean {
  const isKind = node.type === 'VariableDeclaration' && node.kind === kind

  return isKind && node.loc.start.line === node.loc.end.line
}

function exportedDeclaration(node: ESTree.Node): ESTree.Node {
  const isExport =
    node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration'

  return isExport ? (node.declaration ?? node) : node
}

function matchesAny(node: ESTree.Node, statementTypes: readonly StatementType[]): boolean {
  const declaration = exportedDeclaration(node)

  return statementTypes.some((statementType) =>
    STATEMENT_MATCHERS[statementType](declaration, node),
  )
}

function continuesOverloads(previous: ESTree.Node, current: ESTree.Node): boolean {
  const signature = exportedDeclaration(previous)
  const following = exportedDeclaration(current)

  if (signature.type !== 'TSDeclareFunction') {
    return false
  }

  if (following.type !== 'TSDeclareFunction' && following.type !== 'FunctionDeclaration') {
    return false
  }

  return following.id?.name === signature.id?.name
}

function governingBlankLine(
  specs: readonly Spec[],
  previous: ESTree.Node,
  current: ESTree.Node,
): BlankLine | undefined {
  if (continuesOverloads(previous, current)) {
    return undefined
  }

  return specs.findLast((spec) => matchesAny(previous, spec.prev) && matchesAny(current, spec.next))
    ?.blankLine
}

function leadingNode(node: ESTree.Node): ESTree.Node {
  const declaration = exportedDeclaration(node)
  const firstDecorator =
    declaration.type === 'ClassDeclaration' ? declaration.decorators[0] : undefined

  return firstDecorator !== undefined && firstDecorator.range[0] < node.range[0]
    ? firstDecorator
    : node
}

function missingBlankLine(
  sourceCode: SourceCode,
  previous: ESTree.Node,
  current: ESTree.Node,
): Diagnostic | undefined {
  const anchor = fenceAnchor(sourceCode, previous, leadingNode(current))

  if (blankLinesBetween(previous, anchor) !== 0) {
    return undefined
  }

  return {
    node: current,
    messageId: 'expectedBlankLine',
    fix: (fixer) =>
      fixer.insertTextBeforeRange(lineStartRange(anchor), lineBreakOf(sourceCode.text)),
  }
}

function unexpectedBlankLine(
  sourceCode: SourceCode,
  previous: ESTree.Node,
  current: ESTree.Node,
): Diagnostic | undefined {
  const leading = leadingNode(current)
  const gapRange: Range = [previous.range[1], lineStartRange(leading)[0]]
  const gapIsOnlyBlankLines =
    blankLinesBetween(previous, leading) > 0 &&
    ONLY_WHITESPACE.test(sourceCode.text.slice(...gapRange))

  return gapIsOnlyBlankLines
    ? {
        node: current,
        messageId: 'unexpectedBlankLine',
        fix: (fixer) => fixer.replaceTextRange(gapRange, lineBreakOf(sourceCode.text)),
      }
    : undefined
}

function paddingDiagnostic(
  sourceCode: SourceCode,
  specs: readonly Spec[],
  previous: ESTree.Node,
  current: ESTree.Node,
): Diagnostic | undefined {
  const blankLine = governingBlankLine(specs, previous, current)
  const check = blankLine === 'always' ? missingBlankLine : unexpectedBlankLine

  return blankLine === 'any' || blankLine === undefined
    ? undefined
    : check(sourceCode, previous, current)
}

export default defineRule({
  meta: {
    type: 'layout',
    docs: {
      description: 'require or forbid blank lines between statements, per a declarative spec',
    },
    fixable: 'whitespace',
    messages: {
      expectedBlankLine: 'Expected a blank line before this statement.',
      unexpectedBlankLine: 'Unexpected blank line before this statement.',
    },
    schema: [SPECS_SCHEMA],
  },
  create(context) {
    const specs = configuredSpecs(context.options)

    const checkBody = (node: ESTree.Node) => {
      for (const [previous, current] of adjacentPairs(statementsOf(node))) {
        const diagnostic = paddingDiagnostic(context.sourceCode, specs, previous, current)

        if (diagnostic !== undefined) {
          context.report(diagnostic)
        }
      }
    }

    return {
      Program: checkBody,
      BlockStatement: checkBody,
      SwitchCase: checkBody,
      StaticBlock: checkBody,
      TSModuleBlock: checkBody,
    }
  },
})
