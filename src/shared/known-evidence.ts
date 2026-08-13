import * as Option from 'effect/Option'
import type { ESTree, OxlintScope, Variable } from 'effect-oxlint'
import {
  isConstDeclarator,
  isReassigned,
  resolvedVariableForIdentifier,
  variableDeclarator,
} from './binding-scope.ts'
import { isKnownEvidenceExpression } from './widening-targets.ts'

function singleDeclarator(variable: Variable): Option.Option<ESTree.VariableDeclarator> {
  return variable.defs.length === 1 ? variableDeclarator(variable) : Option.none()
}

function stableConstInitializer(variable: Variable): Option.Option<ESTree.Expression> {
  return singleDeclarator(variable).pipe(
    Option.filter((declarator) => isConstDeclarator(declarator) && !isReassigned(variable)),
    Option.flatMap((declarator) => Option.fromNullishOr(declarator.init)),
  )
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
  scopes: readonly OxlintScope[],
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

  return resolvedVariableForIdentifier(scopes, unwrapped).pipe(
    Option.filter((variable) => !visitedVariables.has(variable)),
    Option.exists((variable) =>
      Option.exists(stableConstInitializer(variable), (init) =>
        hasKnownEvidence(scopes, init, new Set([...visitedVariables, variable])),
      ),
    ),
  )
}
