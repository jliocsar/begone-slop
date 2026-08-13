import * as Effect from 'effect/Effect'
import { Diagnostic, type ESTree, type OxlintSourceCode, Rule, RuleContext } from 'effect-oxlint'
import { isConstAssertion, isTypeAssertion, type TypeAssertion } from '../shared/type-assertion.ts'

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
  sourceCode: OxlintSourceCode,
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

export default Rule.define({
  name: 'require-safety-comment-for-type-assertion',
  meta: Rule.meta({
    type: 'problem',
    description: 'require a SAFETY comment on every type assertion except a const assertion',
    messages: { missingSafetyComment: MESSAGE },
  }),
  create: function* () {
    const context = yield* RuleContext

    const report = (node: ESTree.Node) => {
      if (!isTypeAssertion(node) || isConstAssertion(node)) {
        return Effect.void
      }

      return hasSafetyComment(context.sourceCode, node, node)
        ? Effect.void
        : context.report(Diagnostic.fromId({ node, messageId: 'missingSafetyComment' }))
    }

    return { TSAsExpression: report, TSTypeAssertion: report }
  },
})
