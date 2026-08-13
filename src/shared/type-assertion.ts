import type { ESTree } from 'effect-oxlint'

export type TypeAssertion = ESTree.TSAsExpression | ESTree.TSTypeAssertion

const CONST_TYPE_NAME = 'const'

export function isTypeAssertion(node: ESTree.Node): node is TypeAssertion {
  return node.type === 'TSAsExpression' || node.type === 'TSTypeAssertion'
}

export function isConstAssertion(node: TypeAssertion): boolean {
  const { typeAnnotation } = node

  return (
    typeAnnotation.type === 'TSTypeReference' &&
    typeAnnotation.typeName.type === 'Identifier' &&
    typeAnnotation.typeName.name === CONST_TYPE_NAME
  )
}
