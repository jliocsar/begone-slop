import type { ESTree, Range, SourceCode, Span } from '@oxlint/plugins'
import { isNodeOfType } from './node-type.ts'

export function statementsOf(node: ESTree.Node): readonly ESTree.Node[] {
  if (node.type === 'SwitchCase') {
    return node.consequent
  }

  if (isNodeOfType(node, ['Program', 'BlockStatement', 'StaticBlock', 'TSModuleBlock'])) {
    return node.body
  }

  return []
}

export function adjacentPairs(
  body: readonly ESTree.Node[],
): readonly (readonly [ESTree.Node, ESTree.Node])[] {
  return body.flatMap((previous, index): (readonly [ESTree.Node, ESTree.Node])[] => {
    const current = body[index + 1]

    return current === undefined ? [] : [[previous, current]]
  })
}

export function blankLinesBetween(previous: Span, current: Span): number {
  return current.loc.start.line - previous.loc.end.line - 1
}

export function fenceAnchor(
  sourceCode: SourceCode,
  previous: ESTree.Node,
  leading: ESTree.Node,
): Span {
  const introducing = sourceCode
    .getCommentsBefore(leading)
    .filter((comment) => comment.loc.start.line > previous.loc.end.line)

  return introducing[0] ?? leading
}

export function lineStartRange(node: Span): Range {
  const lineStart = node.range[0] - node.loc.start.column

  return [lineStart, lineStart]
}

export function lineBreakOf(text: string): string {
  return /\r?\n/u.exec(text)?.[0] ?? '\n'
}
