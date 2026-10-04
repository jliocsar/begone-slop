import type { Diagnostic, ESTree, SourceCode } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import {
  adjacentPairs,
  blankLinesBetween,
  lineBreakOf,
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
  sourceCode: SourceCode,
  previous: ESTree.Node,
  current: ESTree.Node,
): Diagnostic | undefined {
  const comments = sourceCode.getCommentsBefore(current)
  const introduced = comments.some((comment) => comment.loc.start.line > previous.loc.end.line)

  if (introduced || blankLinesBetween(previous, current) <= 0) {
    return undefined
  }

  const gapStart = comments.at(-1)?.range[1] ?? previous.range[1]
  const [currentLineStart] = lineStartRange(current)

  return {
    node: current,
    messageId: 'denseExpectBlock',
    fix: (fixer) =>
      fixer.replaceTextRange(
        [gapStart, currentLineStart],
        lineBreakOf(sourceCode.text.slice(gapStart, currentLineStart)),
      ),
  }
}

function fenceGap(
  sourceCode: SourceCode,
  previous: ESTree.Node,
  current: ESTree.Node,
): Diagnostic | undefined {
  if (blankLinesBetween(previous, current) !== 0) {
    return undefined
  }

  return {
    node: current,
    messageId: 'fenceExpectBlock',
    fix: (fixer) =>
      fixer.insertTextBeforeRange(lineStartRange(current), lineBreakOf(sourceCode.text)),
  }
}

function gapDiagnostic(
  sourceCode: SourceCode,
  previous: ESTree.Node,
  current: ESTree.Node,
): Diagnostic | undefined {
  const previousIsExpect = isExpectStatement(previous)
  const currentIsExpect = isExpectStatement(current)

  if (previousIsExpect && currentIsExpect) {
    return denseGap(sourceCode, previous, current)
  }

  return previousIsExpect || currentIsExpect ? fenceGap(sourceCode, previous, current) : undefined
}

export default defineRule({
  meta: {
    type: 'layout',
    docs: {
      description: 'require a blank line around a run of expect() calls and none inside it',
    },
    fixable: 'whitespace',
    messages: {
      fenceExpectBlock: 'Add a blank line between this and the adjacent expect() block.',
      denseExpectBlock: 'Remove the blank line(s) between consecutive expect() calls.',
    },
  },
  create(context) {
    const checkBody = (node: ESTree.Node) => {
      for (const [previous, current] of adjacentPairs(statementsOf(node))) {
        const diagnostic = gapDiagnostic(context.sourceCode, previous, current)

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
