import type { ESTree } from '@oxlint/plugins'

const SCREAMING_CASE = /^[A-Z][A-Z0-9_]*$/u

export function isScreamingConstDeclaration(node: ESTree.Node): boolean {
  if (node.type !== 'VariableDeclaration' || node.kind !== 'const') {
    return false
  }

  return (
    node.loc.start.line === node.loc.end.line &&
    node.declarations.every(
      (declarator) =>
        declarator.id.type === 'Identifier' && SCREAMING_CASE.test(declarator.id.name),
    )
  )
}

export function exportedScreamingConst(node: ESTree.Node): ESTree.VariableDeclaration | undefined {
  if (node.type !== 'ExportNamedDeclaration') {
    return undefined
  }

  const { declaration } = node

  return declaration?.type === 'VariableDeclaration' && isScreamingConstDeclaration(declaration)
    ? declaration
    : undefined
}
