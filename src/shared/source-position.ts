/**
 * Shared node and position helpers for the local spacing rules.
 *
 * Handlers take `ESTree.Node` rather than a narrowed type because oxlint's
 * `Visitor` intersects its per-key handlers with a `Record<string, (node: Node)
 * => void>` catch-all, so `TypedEffectVisitor` collapses to that index
 * signature. Narrowing is ours to do.
 */

import * as Arr from 'effect/Array'
import type { ESTree, Range, Span } from 'effect-oxlint'

/** The statement list a body-owning node holds, or empty for anything else. */
export function statementsOf(node: ESTree.Node): readonly ESTree.Node[] {
  if (node.type === 'SwitchCase') {
    return node.consequent
  }

  if (node.type === 'Program' || node.type === 'BlockStatement' || node.type === 'StaticBlock') {
    return node.body
  }

  return []
}

/** Adjacent statement pairs, in source order. */
export function adjacentPairs(
  body: readonly ESTree.Node[],
): readonly (readonly [ESTree.Node, ESTree.Node])[] {
  return Arr.zip(body, body.slice(1))
}

/**
 * Blank lines between two nodes, counted from the gap, so a trailing comment
 * belongs to whichever line it sits on.
 *
 * A comment occupying the gap on its own line is NOT a blank line but does raise
 * `current.loc.start.line`, so a caller allowing introducing comments must
 * measure to the comment, not past it.
 */
export function blankLinesBetween(previous: Span, current: Span): number {
  return current.loc.start.line - previous.loc.end.line - 1
}

/**
 * Where to insert a blank line above `node`: the start of its line, not the node.
 * Inserting directly before the node lands after the indentation, stranding it on
 * the blank line.
 */
export function lineStartRange(node: Span): Range {
  const lineStart = node.range[0] - node.loc.start.column

  return [lineStart, lineStart]
}
