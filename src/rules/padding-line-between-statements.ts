import type { Diagnostic, ESTree, Options, SourceCode } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import {
  adjacentPairs,
  blankLinesBetween,
  fenceAnchor,
  lineBreakOf,
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
  function: (node) => node.type === 'FunctionDeclaration' || node.type === 'TSDeclareFunction',
  class: (node) => node.type === 'ClassDeclaration',
  import: (node) => node.type === 'ImportDeclaration' || node.type === 'TSImportEqualsDeclaration',
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

function isBlockBodiedValue(node: ESTree.Node | null | undefined): boolean {
  return node?.type === 'ClassExpression' || isBlockBodiedFunction(node)
}

function isAssignedBlock(node: ESTree.Node): boolean {
  if (node.type !== 'ExpressionStatement') {
    return false
  }

  const { expression } = node

  return expression.type === 'AssignmentExpression' && isBlockBodiedValue(expression.right)
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

  if (node.type === 'LabeledStatement') {
    return isBlockLike(node.body)
  }

  if (isImmediatelyInvokedBlock(node) || isAssignedBlock(node) || isBlockBodiedValue(node)) {
    return true
  }

  if (node.type === 'VariableDeclaration') {
    return node.declarations.some((declarator) => isBlockBodiedValue(declarator.init))
  }

  return false
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

  return statementTypes.some((statementType) => STATEMENT_MATCHERS[statementType](declaration))
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

function requiresBlankLine(
  specs: readonly Spec[],
  previous: ESTree.Node,
  current: ESTree.Node,
): boolean {
  if (continuesOverloads(previous, current)) {
    return false
  }

  const governingSpec = specs.findLast(
    (spec) => matchesAny(previous, spec.prev) && matchesAny(current, spec.next),
  )

  return governingSpec?.blankLine === 'always'
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
  specs: readonly Spec[],
  previous: ESTree.Node,
  current: ESTree.Node,
): Diagnostic | undefined {
  if (!requiresBlankLine(specs, previous, current)) {
    return undefined
  }

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
      TSModuleBlock: checkBody,
    }
  },
})
