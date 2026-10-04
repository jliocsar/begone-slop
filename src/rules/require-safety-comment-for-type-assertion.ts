import type { Comment, ESTree, SourceCode } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { isNodeOfType } from '../shared/node-type.ts'
import { isConstAssertion, isSafetyComment, type TypeAssertion } from '../shared/type-assertion.ts'

const STATEMENT_KIND = /(?:Declaration|Statement)$/u

const STATEMENT_LIKE_KINDS = new Set([
  'AccessorProperty',
  'PropertyDefinition',
  'TSExportAssignment',
])

const MESSAGE =
  'This type assertion has no `SAFETY:` justification. State the checked invariant immediately before the assertion or its containing statement.'

function isStatement(node: ESTree.Node): boolean {
  return STATEMENT_KIND.test(node.type) || STATEMENT_LIKE_KINDS.has(node.type)
}

function isExportDeclaration(node: ESTree.Node): boolean {
  return isNodeOfType(node, ['ExportNamedDeclaration', 'ExportDefaultDeclaration'])
}

function commentsBefore(sourceCode: SourceCode, current: ESTree.Node): readonly Comment[] {
  const chainLinkComments =
    current.type === 'CallExpression' && current.callee.type === 'MemberExpression'
      ? sourceCode.getCommentsAfter(current.callee.object)
      : []

  return [...sourceCode.getCommentsBefore(current), ...chainLinkComments]
}

function previousJsxSibling(current: ESTree.Node): ESTree.JSXChild | undefined {
  const { parent } = current

  if (parent === null || !isNodeOfType(parent, ['JSXElement', 'JSXFragment'])) {
    return undefined
  }

  const index = parent.children.findIndex((child) => child === current)

  return parent.children
    .slice(0, Math.max(index, 0))
    .findLast((child) => child.type !== 'JSXText' || child.value.trim() !== '')
}

function hasJsxSafetyComment(sourceCode: SourceCode, current: ESTree.Node): boolean {
  const sibling = previousJsxSibling(current)

  return (
    sibling?.type === 'JSXExpressionContainer' &&
    sibling.expression.type === 'JSXEmptyExpression' &&
    sourceCode.getCommentsInside(sibling).some(isSafetyComment)
  )
}

function hasSafetyComment(
  sourceCode: SourceCode,
  node: TypeAssertion,
  current: ESTree.Node,
): boolean {
  const justified = commentsBefore(sourceCode, current).some(
    (comment) => comment.end <= node.start && isSafetyComment(comment),
  )

  if (justified || hasJsxSafetyComment(sourceCode, current)) {
    return true
  }

  const { parent } = current

  if (
    parent === null ||
    parent.type === 'Program' ||
    (isStatement(current) && !isExportDeclaration(parent))
  ) {
    return false
  }

  return hasSafetyComment(sourceCode, node, parent)
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'require a SAFETY comment on every type assertion except a const assertion',
    },
    messages: { missingSafetyComment: MESSAGE },
  },
  create(context) {
    const report = (node: TypeAssertion) => {
      if (!isConstAssertion(node) && !hasSafetyComment(context.sourceCode, node, node)) {
        context.report({ node, messageId: 'missingSafetyComment' })
      }
    }

    return { TSAsExpression: report, TSTypeAssertion: report }
  },
})
