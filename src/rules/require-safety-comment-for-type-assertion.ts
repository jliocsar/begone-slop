import type { ESTree, SourceCode } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { isConstAssertion, type TypeAssertion } from '../shared/type-assertion.ts'

const COMMENT_OWNER_KINDS = new Set([
  'ExpressionStatement',
  'PropertyDefinition',
  'ReturnStatement',
  'ThrowStatement',
  'VariableDeclaration',
])

const SAFETY_PATTERN = /\bSAFETY\s*:/u

const MESSAGE =
  'This type assertion has no `SAFETY:` justification. State the checked invariant immediately before the assertion or its containing statement.'

function hasSafetyComment(
  sourceCode: SourceCode,
  node: TypeAssertion,
  current: ESTree.Node,
): boolean {
  const justified = sourceCode
    .getCommentsBefore(current)
    .some((comment) => comment.end <= node.start && SAFETY_PATTERN.test(comment.value))

  if (justified) {
    return true
  }

  const { parent } = current

  if (COMMENT_OWNER_KINDS.has(current.type) || parent === null || parent.type === 'Program') {
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
