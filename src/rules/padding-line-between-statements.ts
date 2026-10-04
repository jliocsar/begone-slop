import type { Diagnostic, ESTree, Options, SourceCode, Span } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import {
  adjacentPairs,
  blankLinesBetween,
  lineStartRange,
  statementsOf,
} from '../shared/source-position.ts'

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
] as const

type StatementType = (typeof STATEMENT_TYPES)[number]

const BLANK_LINES = ['always', 'any'] as const

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

const BLOCK_OWNING_STATEMENTS = new Set([
  'BlockStatement',
  'IfStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'SwitchStatement',
  'TryStatement',
])

const STATEMENT_MATCHERS = {
  '*': () => true,
  return: (node) => node.type === 'ReturnStatement',
  'block-like': isBlockLike,
  function: (node) => node.type === 'FunctionDeclaration',
  class: (node) => node.type === 'ClassDeclaration',
  import: (node) => node.type === 'ImportDeclaration',
  'singleline-const': (node) => isSingleLineDeclaration(node, 'const'),
  'singleline-let': (node) => isSingleLineDeclaration(node, 'let'),
} satisfies Record<StatementType, (node: ESTree.Node) => boolean>

function configuredSpecs(options: Readonly<Options>): readonly Spec[] {
  // SAFETY: oxlint validates configured options against meta.schema before create runs
  const configured = options[0] as readonly SpecOption[] | undefined

  return (configured ?? []).map(({ blankLine, prev, next }) => ({
    blankLine,
    prev: [prev].flat(),
    next: [next].flat(),
  }))
}

function isBlockBodiedFunction(node: ESTree.Node | null | undefined): boolean {
  if (node === null || node === undefined) {
    return false
  }

  const isFunction = node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression'

  return isFunction && node.body?.type === 'BlockStatement'
}

function isImmediatelyInvokedBlock(node: ESTree.Node): boolean {
  if (node.type !== 'ExpressionStatement') {
    return false
  }

  const call =
    node.expression.type === 'AwaitExpression' ? node.expression.argument : node.expression

  return call.type === 'CallExpression' && isBlockBodiedFunction(call.callee)
}

function isBlockLike(node: ESTree.Node): boolean {
  if (BLOCK_OWNING_STATEMENTS.has(node.type)) {
    return true
  }

  if (isImmediatelyInvokedBlock(node)) {
    return true
  }

  if (node.type === 'VariableDeclaration') {
    return node.declarations.some((declarator) => isBlockBodiedFunction(declarator.init))
  }

  return false
}

function isSingleLineDeclaration(node: ESTree.Node, kind: 'const' | 'let'): boolean {
  const isKind = node.type === 'VariableDeclaration' && node.kind === kind

  return isKind && node.loc.start.line === node.loc.end.line
}

function matchesAny(node: ESTree.Node, statementTypes: readonly StatementType[]): boolean {
  return statementTypes.some((statementType) => STATEMENT_MATCHERS[statementType](node))
}

function requiresBlankLine(
  specs: readonly Spec[],
  previous: ESTree.Node,
  current: ESTree.Node,
): boolean {
  const governingSpec = specs.findLast(
    (spec) => matchesAny(previous, spec.prev) && matchesAny(current, spec.next),
  )

  return governingSpec?.blankLine === 'always'
}

function fenceAnchor(sourceCode: SourceCode, previous: ESTree.Node, current: ESTree.Node): Span {
  const introducing = sourceCode
    .getCommentsBefore(current)
    .filter((comment) => comment.loc.start.line > previous.loc.end.line)

  return introducing[0] ?? current
}

function missingBlankLine(
  sourceCode: SourceCode,
  specs: readonly Spec[],
  previous: ESTree.Node,
  current: ESTree.Node,
): Diagnostic | undefined {
  if (!requiresBlankLine(specs, previous, current)) {
    return undefined
  }

  const anchor = fenceAnchor(sourceCode, previous, current)

  if (blankLinesBetween(previous, anchor) !== 0) {
    return undefined
  }

  return {
    node: current,
    messageId: 'expectedBlankLine',
    fix: (fixer) => fixer.insertTextBeforeRange(lineStartRange(anchor), '\n'),
  }
}

export default defineRule({
  meta: {
    type: 'layout',
    docs: { description: 'require blank lines between statements, per a declarative spec' },
    fixable: 'whitespace',
    messages: { expectedBlankLine: 'Expected a blank line before this statement.' },
    schema: [SPECS_SCHEMA],
  },
  create(context) {
    const specs = configuredSpecs(context.options)

    const checkBody = (node: ESTree.Node) => {
      for (const [previous, current] of adjacentPairs(statementsOf(node))) {
        const diagnostic = missingBlankLine(context.sourceCode, specs, previous, current)

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
    }
  },
})
