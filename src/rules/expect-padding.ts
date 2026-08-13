/**
 * A run of consecutive `expect(...)` statements is one block: blank line around
 * it, none inside it.
 *
 * A comment on its own line between two assertions is exempt, along with the
 * spacing around it — it is a real reason to break the block, and without the
 * exemption the dense-block fixer deleted the note. A trailing comment is part
 * of its line, so the gap below it still closes.
 *
 * Fixable both ways.
 */

import * as Arr from 'effect/Array'
import * as Effect from 'effect/Effect'
import { pipe } from 'effect/Function'
import * as Option from 'effect/Option'
import { Diagnostic, type ESTree, type OxlintSourceCode, Rule, RuleContext } from 'effect-oxlint'
import {
  adjacentPairs,
  blankLinesBetween,
  lineStartRange,
  statementsOf,
} from '../shared/source-position.ts'

/** The root of a call/member chain: `expect(x).resolves.toBe(y)` → `expect`. */
function chainRoot(expression: ESTree.Expression): ESTree.Expression {
  if (expression.type === 'AwaitExpression') {
    return chainRoot(expression.argument)
  }

  if (expression.type === 'CallExpression') {
    return chainRoot(expression.callee)
  }

  if (expression.type === 'MemberExpression') {
    return chainRoot(expression.object)
  }

  return expression
}

function isExpectStatement(statement: ESTree.Node): boolean {
  if (statement.type !== 'ExpressionStatement') {
    return false
  }

  const root = chainRoot(statement.expression)

  return root.type === 'Identifier' && root.name === 'expect'
}

/** Inside the block: consecutive assertions, so close any gap between them. */
function denseGap(
  sourceCode: OxlintSourceCode,
  previous: ESTree.Node,
  current: ESTree.Node,
): Option.Option<Diagnostic.Diagnostic> {
  const comments = sourceCode.getCommentsBefore(current)
  // A note on its own line is content, not spacing.
  const introduced = comments.some((comment) => comment.loc.start.line > previous.loc.end.line)

  return pipe(
    current,
    Option.liftPredicate(() => !introduced && blankLinesBetween(previous, current) > 0),
    Option.map(() =>
      Diagnostic.withFix(
        Diagnostic.fromId({ node: current, messageId: 'denseExpectBlock' }),
        // Replace the whole gap so several blank lines collapse at once,
        // starting after any trailing comment on the previous line.
        (fixer) =>
          fixer.replaceTextRange(
            [comments.at(-1)?.range[1] ?? previous.range[1], current.range[0]],
            `\n${' '.repeat(current.loc.start.column)}`,
          ),
      ),
    ),
  )
}

/** The block's edge: exactly one side is an assertion, so fence it off. */
function fenceGap(
  previous: ESTree.Node,
  current: ESTree.Node,
): Option.Option<Diagnostic.Diagnostic> {
  return pipe(
    current,
    Option.liftPredicate(() => blankLinesBetween(previous, current) === 0),
    Option.map(() =>
      Diagnostic.withFix(
        Diagnostic.fromId({ node: current, messageId: 'fenceExpectBlock' }),
        (fixer) => fixer.insertTextBeforeRange(lineStartRange(current), '\n'),
      ),
    ),
  )
}

/** None where neither side is an assertion — the vertical-spacing rules own it. */
function gapDiagnostic(
  sourceCode: OxlintSourceCode,
  previous: ESTree.Node,
  current: ESTree.Node,
): Option.Option<Diagnostic.Diagnostic> {
  const previousIsExpect = isExpectStatement(previous)
  const currentIsExpect = isExpectStatement(current)

  if (previousIsExpect && currentIsExpect) {
    return denseGap(sourceCode, previous, current)
  }

  return previousIsExpect || currentIsExpect ? fenceGap(previous, current) : Option.none()
}

export default Rule.define({
  name: 'expect-padding',
  meta: Rule.meta({
    type: 'layout',
    description: 'require a blank line around a run of expect() calls and none inside it',
    fixable: 'whitespace',
    messages: {
      fenceExpectBlock: 'Add a blank line between this and the adjacent expect() block.',
      denseExpectBlock: 'Remove the blank line(s) between consecutive expect() calls.',
    },
  }),
  create: function* () {
    const context = yield* RuleContext

    const checkBody = (node: ESTree.Node) =>
      Effect.forEach(
        Arr.getSomes(
          adjacentPairs(statementsOf(node)).map(([previous, current]) =>
            gapDiagnostic(context.sourceCode, previous, current),
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
