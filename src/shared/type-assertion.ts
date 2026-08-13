/**
 * Shared shape of a TypeScript assertion, for the two rules that walk assertion
 * chains.
 *
 * `as const` is the one assertion that adds evidence rather than discarding it,
 * so both rules exempt it and both need the same test. The angle-bracket form
 * (`<T>value`) is the same operator with a different spelling, so both rules
 * visit `TSTypeAssertion` alongside `TSAsExpression`.
 */

import type { ESTree } from 'effect-oxlint'

export type TypeAssertion = ESTree.TSAsExpression | ESTree.TSTypeAssertion

const CONST_TYPE_NAME = 'const'

export function isTypeAssertion(node: ESTree.Node): node is TypeAssertion {
  return node.type === 'TSAsExpression' || node.type === 'TSTypeAssertion'
}

/** `x as const` and `<const>x` — a type reference whose name is `const`. */
export function isConstAssertion(node: TypeAssertion): boolean {
  const { typeAnnotation } = node

  return (
    typeAnnotation.type === 'TSTypeReference' &&
    typeAnnotation.typeName.type === 'Identifier' &&
    typeAnnotation.typeName.name === CONST_TYPE_NAME
  )
}

/**
 * The expression inside any number of parentheses, so `(x as A) as B` reads as
 * one chain. oxlint 1.77.0 emits no `ParenthesizedExpression` node at all
 * (measured), which makes this a guard against that parser option flipping
 * rather than something the current AST exercises.
 */
export function unwrapParenthesizedExpression(expression: ESTree.Expression): ESTree.Expression {
  return expression.type === 'ParenthesizedExpression'
    ? unwrapParenthesizedExpression(expression.expression)
    : expression
}
