import type { Comment, ESTree } from '@oxlint/plugins'

export type TypeAssertion = ESTree.TSAsExpression | ESTree.TSTypeAssertion

const CONST_TYPE_NAME = 'const'
const SAFETY_COMMENT = /^[\s*]*SAFETY:/u

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

export function isSafetyComment(comment: Comment): boolean {
  return SAFETY_COMMENT.test(comment.value)
}
