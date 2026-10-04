import type { ESTree, Range, Span } from '@oxlint/plugins'

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
  return body.flatMap((previous, index): (readonly [ESTree.Node, ESTree.Node])[] => {
    const current = body[index + 1]

    return current === undefined ? [] : [[previous, current]]
  })
}

export function blankLinesBetween(previous: Span, current: Span): number {
  return current.loc.start.line - previous.loc.end.line - 1
}

export function lineStartRange(node: Span): Range {
  const lineStart = node.range[0] - node.loc.start.column

  return [lineStart, lineStart]
}

export function lineBreakOf(text: string): string {
  return /\r?\n/u.exec(text)?.[0] ?? '\n'
}
