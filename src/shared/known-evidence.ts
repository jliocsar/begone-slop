/**
 * Whether a value's shape is visible where it is written, answered from syntax
 * alone. A literal, an object, an array, a `new` or a function is its own
 * evidence; a call result is not.
 *
 * The walk follows `const` bindings, so `const source = { … }` used one line
 * later is still the object that was written. A `let`, a reassigned binding or
 * a name declared more than once stops it: the value is no longer the one on
 * the page.
 */

import * as Option from 'effect/Option'
import type { ESTree, OxlintScope, Variable } from 'effect-oxlint'
import {
  isConstDeclarator,
  isReassigned,
  resolvedVariableForIdentifier,
  variableDeclarator,
} from './binding-scope.ts'
import { isKnownEvidenceExpression } from './widening-targets.ts'

/**
 * The declarator of a binding declared exactly once. Two declarations mean the
 * name is not one value, so nothing about it can be read syntactically.
 */
function singleDeclarator(variable: Variable): Option.Option<ESTree.VariableDeclarator> {
  return variable.defs.length === 1 ? variableDeclarator(variable) : Option.none()
}

/** The initializer of a `const` nothing else writes to. */
function stableConstInitializer(variable: Variable): Option.Option<ESTree.Expression> {
  return singleDeclarator(variable).pipe(
    Option.filter((declarator) => isConstDeclarator(declarator) && !isReassigned(variable)),
    Option.flatMap((declarator) => Option.fromNullishOr(declarator.init)),
  )
}

/**
 * Wrappers that change the type but not the value. `ParenthesizedExpression`
 * is inert: oxlint 1.77.0 emits none (oxc strips redundant parens, measured).
 */
export function unwrapExpression(expression: ESTree.Expression): ESTree.Expression {
  if (
    expression.type === 'ParenthesizedExpression' ||
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

/**
 * `visitedVariables` is what stops `const first = second; const second = first`
 * from recurring forever; callers start it empty.
 */
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
