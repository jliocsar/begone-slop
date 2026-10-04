import type { ESTree } from '@oxlint/plugins'

const BLOCK_OWNING_STATEMENTS = new Set([
  'BlockStatement',
  'IfStatement',
  'ForStatement',
  'ForInStatement',
  'ForOfStatement',
  'WhileStatement',
  'DoWhileStatement',
  'SwitchStatement',
  'TryStatement',
])

function isBlockBodiedFunction(node: ESTree.Node | null | undefined): boolean {
  if (node === null || node === undefined) {
    return false
  }

  const isFunction = node.type === 'FunctionExpression' || node.type === 'ArrowFunctionExpression'

  return isFunction && node.body?.type === 'BlockStatement'
}

function isBlockBodiedValue(node: ESTree.Node | null | undefined): boolean {
  return node?.type === 'ClassExpression' || isBlockBodiedFunction(node)
}

function isAssignedBlock(node: ESTree.Node): boolean {
  if (node.type !== 'ExpressionStatement') {
    return false
  }

  const { expression } = node

  return expression.type === 'AssignmentExpression' && isBlockBodiedValue(expression.right)
}

function isImmediatelyInvokedBlock(node: ESTree.Node): boolean {
  if (node.type !== 'ExpressionStatement') {
    return false
  }

  const call =
    node.expression.type === 'AwaitExpression' ? node.expression.argument : node.expression

  return call.type === 'CallExpression' && isBlockBodiedFunction(call.callee)
}

export function isBlockLike(node: ESTree.Node): boolean {
  if (BLOCK_OWNING_STATEMENTS.has(node.type)) {
    return true
  }

  if (node.type === 'LabeledStatement') {
    return isBlockLike(node.body)
  }

  if (isImmediatelyInvokedBlock(node) || isAssignedBlock(node) || isBlockBodiedValue(node)) {
    return true
  }

  if (node.type === 'VariableDeclaration') {
    return node.declarations.some((declarator) => isBlockBodiedValue(declarator.init))
  }

  return false
}
