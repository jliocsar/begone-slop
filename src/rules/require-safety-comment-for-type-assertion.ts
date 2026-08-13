/**
 * A type assertion overrides the checker, so the invariant that makes it sound
 * lives only in the author's head unless a `SAFETY:` comment writes it down.
 *
 * The comment may sit immediately before the assertion or before the statement
 * that contains it: the search walks up from the assertion and stops at the
 * first comment-owning statement (expression, property, return, throw,
 * variable) or at the top level — checking that level before it stops. A
 * trailing comment is not a justification: it must end before the assertion
 * begins. `as const` is exempt; it narrows instead of overriding.
 *
 * Report-only — only the author knows the invariant.
 */

import * as Effect from 'effect/Effect'
import { Diagnostic, type ESTree, type OxlintSourceCode, Rule, RuleContext } from 'effect-oxlint'
import { isConstAssertion, isTypeAssertion, type TypeAssertion } from '../shared/type-assertion.ts'

/**
 * The statements a comment can be read as belonging to. Reaching one ends the
 * walk: a comment further up is about something else.
 */
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

  // `parent` is null only on `Program`, which the top-level stop below reaches
  // first — the check is what convinces the checker of that.
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
