import type { ESTree } from '@oxlint/plugins'

export function rootIdentifierName(node: ESTree.Node): string | undefined {
  if (node.type === 'CallExpression') {
    return rootIdentifierName(node.callee)
  }

  if (node.type === 'MemberExpression') {
    return rootIdentifierName(node.object)
  }

  return node.type === 'Identifier' ? node.name : undefined
}
