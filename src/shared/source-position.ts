import * as Arr from 'effect/Array'
import type { ESTree, Range, Span } from 'effect-oxlint'

export function statementsOf(node: ESTree.Node): readonly ESTree.Node[] {
  if (node.type === 'SwitchCase') {
    return node.consequent
  }

  if (node.type === 'Program' || node.type === 'BlockStatement' || node.type === 'StaticBlock') {
    return node.body
  }

  return []
}

export function adjacentPairs(
  body: readonly ESTree.Node[],
): readonly (readonly [ESTree.Node, ESTree.Node])[] {
  return Arr.zip(body, body.slice(1))
}

export function blankLinesBetween(previous: Span, current: Span): number {
  return current.loc.start.line - previous.loc.end.line - 1
}

export function lineStartRange(node: Span): Range {
  const lineStart = node.range[0] - node.loc.start.column

  return [lineStart, lineStart]
}
