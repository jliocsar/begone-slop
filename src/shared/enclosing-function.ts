import type { ESTree, SourceCode } from '@oxlint/plugins'

export type FunctionOwner = ESTree.ArrowFunctionExpression | ESTree.Function

const ANONYMOUS_FUNCTION_NAME = 'anonymous function'

function isFunctionOwner(node: ESTree.Node): node is FunctionOwner {
  return (
    node.type === 'ArrowFunctionExpression' ||
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression'
  )
}

export function enclosingFunction(node: ESTree.Node): FunctionOwner | undefined {
  const { parent } = node

  if (parent === null || parent.type === 'Program') {
    return undefined
  }

  return isFunctionOwner(parent) ? parent : enclosingFunction(parent)
}

export function sourceKeyName(sourceCode: SourceCode, key: ESTree.PropertyKey): string {
  if (key.type === 'Identifier' || key.type === 'PrivateIdentifier') {
    return key.name
  }

  return key.type === 'Literal' ? String(key.value) : sourceCode.getText(key)
}

function inheritedFunctionName(sourceCode: SourceCode, owner: FunctionOwner): string | undefined {
  const { parent } = owner

  if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
    return parent.id.name
  }

  return parent.type === 'MethodDefinition' ? sourceKeyName(sourceCode, parent.key) : undefined
}

export function functionName(sourceCode: SourceCode, owner: FunctionOwner | undefined): string {
  if (owner === undefined) {
    return ANONYMOUS_FUNCTION_NAME
  }

  if (owner.id !== null && owner.id !== undefined) {
    return owner.id.name
  }

  return inheritedFunctionName(sourceCode, owner) ?? ANONYMOUS_FUNCTION_NAME
}
