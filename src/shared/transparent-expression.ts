import type { ESTree } from '@oxlint/plugins'
import { isNodeOfType } from './node-type.ts'

const TRANSPARENT_WRAPPER_TYPES = [
  'ChainExpression',
  'ParenthesizedExpression',
  'TSAsExpression',
  'TSNonNullExpression',
  'TSSatisfiesExpression',
  'TSTypeAssertion',
] as const

export function unwrapTransparentExpression(node: ESTree.Node): ESTree.Node {
  if (isNodeOfType(node, TRANSPARENT_WRAPPER_TYPES)) {
    return unwrapTransparentExpression(node.expression)
  }

  return node
}

export function outermostTransparentWrapper(node: ESTree.Node): ESTree.Node {
  const { parent } = node

  if (
    parent !== null &&
    isNodeOfType(parent, TRANSPARENT_WRAPPER_TYPES) &&
    parent.expression === node
  ) {
    return outermostTransparentWrapper(parent)
  }

  return node
}
