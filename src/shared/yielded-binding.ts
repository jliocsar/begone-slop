import type { ESTree, SourceCode } from '@oxlint/plugins'
import { findVariable, isConstDeclarator, variableDeclarator } from './binding-scope.ts'
import { unwrapTransparentExpression } from './transparent-expression.ts'

export function yieldedArgument(node: ESTree.Node | null | undefined): ESTree.Node | undefined {
  if (node === null || node === undefined) {
    return undefined
  }

  const expression = unwrapTransparentExpression(node)

  if (
    expression.type !== 'YieldExpression' ||
    !expression.delegate ||
    expression.argument === null
  ) {
    return undefined
  }

  return unwrapTransparentExpression(expression.argument)
}

export function yieldedInto(sourceCode: SourceCode, node: ESTree.Node): ESTree.Node | undefined {
  const expression = unwrapTransparentExpression(node)

  if (expression.type !== 'Identifier') {
    return undefined
  }

  const variable = findVariable(sourceCode.getScope(expression), expression.name)
  const declarator = variable?.defs.length === 1 ? variableDeclarator(variable) : undefined

  if (declarator === undefined || !isConstDeclarator(declarator)) {
    return undefined
  }

  return yieldedArgument(declarator.init)
}
