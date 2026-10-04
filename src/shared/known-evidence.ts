import type { ESTree, Scope, Variable } from '@oxlint/plugins'
import {
  isConstDeclarator,
  isReassigned,
  resolvedVariableForIdentifier,
  variableDeclarator,
} from './binding-scope.ts'
import { isKnownEvidenceExpression } from './widening-targets.ts'

function singleDeclarator(variable: Variable): ESTree.VariableDeclarator | undefined {
  return variable.defs.length === 1 ? variableDeclarator(variable) : undefined
}

function stableConstInitializer(variable: Variable): ESTree.Expression | undefined {
  const declarator = singleDeclarator(variable)

  if (declarator === undefined || !isConstDeclarator(declarator) || isReassigned(variable)) {
    return undefined
  }

  return declarator.init ?? undefined
}

function unwrapExpression(expression: ESTree.Expression): ESTree.Expression {
  if (
    expression.type === 'TSAsExpression' ||
    expression.type === 'TSSatisfiesExpression' ||
    expression.type === 'TSTypeAssertion' ||
    expression.type === 'TSNonNullExpression'
  ) {
    return unwrapExpression(expression.expression)
  }

  return expression
}

export function isEmptyObjectExpression(expression: ESTree.Expression): boolean {
  const unwrapped = unwrapExpression(expression)

  return unwrapped.type === 'ObjectExpression' && unwrapped.properties.length === 0
}

export function hasKnownEvidence(
  scopes: readonly Scope[],
  expression: ESTree.Expression,
  visitedVariables: ReadonlySet<Variable>,
): boolean {
  if (isKnownEvidenceExpression(expression)) {
    return true
  }

  const unwrapped = unwrapExpression(expression)

  if (unwrapped.type !== 'Identifier') {
    return false
  }

  const variable = resolvedVariableForIdentifier(scopes, unwrapped)

  if (variable === undefined || visitedVariables.has(variable)) {
    return false
  }

  const init = stableConstInitializer(variable)

  return (
    init !== undefined && hasKnownEvidence(scopes, init, new Set([...visitedVariables, variable]))
  )
}
