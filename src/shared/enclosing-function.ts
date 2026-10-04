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

function isExportDeclaration(node: ESTree.Node): boolean {
  return node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration'
}

function siblingsOf(parent: ESTree.Node): readonly ESTree.Node[] {
  if (
    parent.type === 'Program' ||
    parent.type === 'BlockStatement' ||
    parent.type === 'TSModuleBlock' ||
    parent.type === 'ClassBody'
  ) {
    return parent.body
  }

  return []
}

function previousSibling(node: ESTree.Node): ESTree.Node | undefined {
  const { parent } = node

  if (parent === null) {
    return undefined
  }

  const siblings = siblingsOf(parent)

  return siblings[siblings.indexOf(node) - 1]
}

function declaredSignatureName(statement: ESTree.Node): string | undefined {
  const declaration =
    statement.type === 'ExportNamedDeclaration' || statement.type === 'ExportDefaultDeclaration'
      ? statement.declaration
      : statement

  return declaration?.type === 'TSDeclareFunction' ? declaration.id?.name : undefined
}

function isMethodOverloadImplementation(
  sourceCode: SourceCode,
  method: ESTree.MethodDefinition,
): boolean {
  const previous = previousSibling(method)

  return (
    previous?.type === 'MethodDefinition' &&
    previous.value.type === 'TSEmptyBodyFunctionExpression' &&
    previous.static === method.static &&
    sourceKeyName(sourceCode, previous.key) === sourceKeyName(sourceCode, method.key)
  )
}

export function isOverloadImplementation(sourceCode: SourceCode, owner: FunctionOwner): boolean {
  const { parent } = owner

  if (parent.type === 'MethodDefinition') {
    return isMethodOverloadImplementation(sourceCode, parent)
  }

  if (owner.type !== 'FunctionDeclaration' || owner.id === null || owner.id === undefined) {
    return false
  }

  const previous = previousSibling(isExportDeclaration(parent) ? parent : owner)

  return previous !== undefined && declaredSignatureName(previous) === owner.id.name
}
