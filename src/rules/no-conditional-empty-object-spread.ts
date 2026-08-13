/**
 * `{ ...(present ? { value } : {}) }` omits a property by spreading nothing.
 * The empty branch carries the decision, so whether the key exists is invisible
 * at the point that reads the object. Build the object in steps instead, and
 * add the key only when it is there.
 *
 * Only spreads INTO an object literal count — an array or call spread of the
 * same conditional omits nothing.
 *
 * Report-only, deliberately: any rewrite changes which keys the object ends up
 * with, so the fix belongs to whoever knows the shape.
 */

import * as Effect from 'effect/Effect'
import { Diagnostic, type ESTree, Rule, RuleContext } from 'effect-oxlint'

const MESSAGE =
  'This conditional spread hides property omission behind an empty object. Build the object in separate statements and add the property only when present.'

/** oxlint keeps parentheses as real nodes, and a spread conditional is usually written with them. */
function withoutParentheses(expression: ESTree.Expression): ESTree.Expression {
  return expression.type === 'ParenthesizedExpression'
    ? withoutParentheses(expression.expression)
    : expression
}

function isEmptyObjectLiteral(expression: ESTree.Expression): boolean {
  return expression.type === 'ObjectExpression' && expression.properties.length === 0
}

function omitsThroughEmptyBranch(expression: ESTree.Expression): boolean {
  const conditional = withoutParentheses(expression)

  return (
    conditional.type === 'ConditionalExpression' &&
    (isEmptyObjectLiteral(conditional.consequent) || isEmptyObjectLiteral(conditional.alternate))
  )
}

export default Rule.define({
  name: 'no-conditional-empty-object-spread',
  meta: Rule.meta({
    type: 'suggestion',
    description: 'forbid object spreads that omit a field by spreading an empty object',
    messages: { noConditionalEmptyObjectSpread: MESSAGE },
  }),
  create: function* () {
    const context = yield* RuleContext

    return {
      SpreadElement: (node: ESTree.Node) => {
        if (node.type !== 'SpreadElement' || node.parent.type !== 'ObjectExpression') {
          return Effect.void
        }

        return omitsThroughEmptyBranch(node.argument)
          ? context.report(Diagnostic.fromId({ node, messageId: 'noConditionalEmptyObjectSpread' }))
          : Effect.void
      },
    }
  },
})
