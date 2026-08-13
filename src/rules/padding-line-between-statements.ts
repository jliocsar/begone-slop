import * as Arr from 'effect/Array'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Match from 'effect/Match'
import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'
import {
  Diagnostic,
  type ESTree,
  type OxlintSourceCode,
  Rule,
  RuleContext,
  type Span,
} from 'effect-oxlint'
import {
  adjacentPairs,
  blankLinesBetween,
  lineStartRange,
  statementsOf,
} from '../shared/source-position.ts'

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

const StatementType = Schema.Literals(STATEMENT_TYPES)
type StatementType = typeof StatementType.Type

const Spec = Schema.Struct({
  blankLine: Schema.Literals(['always', 'any']),
  prev: Schema.ArrayEnsure(StatementType),
  next: Schema.ArrayEnsure(StatementType),
})

const Specs = Schema.Array(Spec)
type Specs = typeof Specs.Type

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

function matchesType(node: ESTree.Node, type: StatementType): boolean {
  return Match.value(type).pipe(
    Match.when('*', () => true),
    Match.when('return', () => node.type === 'ReturnStatement'),
    Match.when('block-like', () => isBlockLike(node)),
    Match.when('function', () => node.type === 'FunctionDeclaration'),
    Match.when('class', () => node.type === 'ClassDeclaration'),
    Match.when('import', () => node.type === 'ImportDeclaration'),
    Match.when('singleline-const', () => isSingleLineDeclaration(node, 'const')),
    Match.when('singleline-let', () => isSingleLineDeclaration(node, 'let')),
    Match.exhaustive,
  )
}

function requiresBlankLine(specs: Specs, previous: ESTree.Node, current: ESTree.Node): boolean {
  const matches = (node: ESTree.Node, types: readonly StatementType[]) =>
    types.some((type) => matchesType(node, type))

  return Arr.findLast(
    specs,
    (spec) => matches(previous, spec.prev) && matches(current, spec.next),
  ).pipe(
    Option.map((spec) => spec.blankLine === 'always'),
    Option.getOrElse(() => false),
  )
}

function fenceAnchor(
  sourceCode: OxlintSourceCode,
  previous: ESTree.Node,
  current: ESTree.Node,
): Span {
  const introducing = sourceCode
    .getCommentsBefore(current)
    .filter((comment) => comment.loc.start.line > previous.loc.end.line)

  return introducing[0] ?? current
}

function missingBlankLine(
  sourceCode: OxlintSourceCode,
  specs: Specs,
  previous: ESTree.Node,
  current: ESTree.Node,
): Option.Option<Diagnostic.Diagnostic> {
  return pipe(
    fenceAnchor(sourceCode, previous, current),
    Option.liftPredicate(() => requiresBlankLine(specs, previous, current)),
    Option.filter((anchor) => blankLinesBetween(previous, anchor) === 0),
    Option.map((anchor) =>
      Diagnostic.withFix(
        Diagnostic.fromId({ node: current, messageId: 'expectedBlankLine' }),
        (fixer) => fixer.insertTextBeforeRange(lineStartRange(anchor), '\n'),
      ),
    ),
  )
}

export default Rule.define({
  name: 'padding-line-between-statements',
  meta: {
    ...Rule.meta({
      type: 'layout',
      description: 'require blank lines between statements, per a declarative spec',
      fixable: 'whitespace',
      messages: { expectedBlankLine: 'Expected a blank line before this statement.' },
    }),
    schema: [{ type: 'array' }],
  },
  options: Specs,
  create: function* (specs) {
    const context = yield* RuleContext

    const checkBody = (node: ESTree.Node) =>
      Effect.forEach(
        Arr.getSomes(
          adjacentPairs(statementsOf(node)).map(([previous, current]) =>
            missingBlankLine(context.sourceCode, specs, previous, current),
          ),
        ),
        context.report,
        { discard: true },
      )

    return {
      Program: checkBody,
      BlockStatement: checkBody,
      SwitchCase: checkBody,
      StaticBlock: checkBody,
    }
  },
})
