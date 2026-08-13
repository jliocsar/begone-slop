/**
 * The vertical-spacing spec, ported from
 * `@stylistic/padding-line-between-statements` — oxlint has no equivalent. Takes
 * the same `{ blankLine, prev, next }` entries (last match wins), so the spec
 * stays declarative in the config; they arrive as ONE array argument because
 * `Rule.define` decodes `options[0]` only.
 *
 * Narrowed to what this repo writes: `blankLine: 'never'` and unknown statement
 * types fail to decode rather than becoming silent no-ops.
 *
 * `block-like` is classified structurally rather than by the original's token
 * walk, which needs `getLastToken`/`getNodeByRangeIndex`. The two readings agree
 * on everything the spec covers.
 */

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

/** The statement types this port understands. Anything else fails to decode. */
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

/** `prev`/`next` accept a single type or a list; a list matches on any member. */
const Spec = Schema.Struct({
  blankLine: Schema.Literals(['always', 'any']),
  prev: Schema.ArrayEnsure(StatementType),
  next: Schema.ArrayEnsure(StatementType),
})

const Specs = Schema.Array(Spec)
type Specs = typeof Specs.Type

/**
 * Statements that own a block outright, as opposed to one reached through an
 * initialiser (`const f = () => { … }`) or a call (an IIFE).
 */
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

/**
 * A function or arrow whose body is a block — the shape that makes a `const`
 * declaration block-like, since the closing brace is the body's.
 */
function isBlockBodiedFunction(node: ESTree.Node | null | undefined): boolean {
  if (node === null || node === undefined) {
    return false
  }

  const isFunction = node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression'

  return isFunction && node.body?.type === 'BlockStatement'
}

/** `(function () { … })()` and `(() => { … })()` written as a statement. */
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

  // `const handler = () => { … }` — the block belongs to the initialiser.
  if (node.type === 'VariableDeclaration') {
    return node.declarations.some((declarator) => isBlockBodiedFunction(declarator.init))
  }

  return false
}

function isSingleLineDeclaration(node: ESTree.Node, kind: 'const' | 'let'): boolean {
  const isKind = node.type === 'VariableDeclaration' && node.kind === kind

  return isKind && node.loc.start.line === node.loc.end.line
}

/** `Match.exhaustive`: a new entry in `STATEMENT_TYPES` fails to compile here. */
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

/**
 * Last matching entry wins, which is what lets the broad `always` rules lead and
 * the `any` exceptions trail.
 */
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

/**
 * Where the blank line goes. A comment above `current` introduces it, so the
 * fence belongs above the comment — and the gap is measured to the comment,
 * since a comment line is not a blank line.
 */
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
    // oxlint rejects options outright unless `schema` is present. It only has to
    // admit the one array argument; `Specs` below is what actually validates it.
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
