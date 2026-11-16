import type { ESTree, SourceCode } from '@oxlint/plugins'
import { findVariable } from './binding-scope.ts'

export function namesTheGlobal(sourceCode: SourceCode, node: ESTree.Node, name: string): boolean {
  if (node.type !== 'Identifier' || node.name !== name) {
    return false
  }

  if (sourceCode.isGlobalReference(node)) {
    return true
  }

  const variable = findVariable(sourceCode.getScope(node), name)

  return variable === undefined || variable.defs.length === 0
}
