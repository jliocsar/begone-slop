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

const EXPECT_IDENTIFIER = 'expect'

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

  return root.type === 'Identifier' && root.name === EXPECT_IDENTIFIER
}

function denseGap(
  sourceCode: OxlintSourceCode,
  previous: ESTree.Node,
  current: ESTree.Node,
): Option.Option<Diagnostic.Diagnostic> {
  const comments = sourceCode.getCommentsBefore(current)
  const introduced = comments.some((comment) => comment.loc.start.line > previous.loc.end.line)

  return pipe(
    current,
    Option.liftPredicate(() => !introduced && blankLinesBetween(previous, current) > 0),
    Option.map(() =>
      Diagnostic.withFix(
        Diagnostic.fromId({ node: current, messageId: 'denseExpectBlock' }),
        (fixer) =>
          fixer.replaceTextRange(
            [comments.at(-1)?.range[1] ?? previous.range[1], current.range[0]],
            `\n${' '.repeat(current.loc.start.column)}`,
          ),
      ),
    ),
  )
}

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
