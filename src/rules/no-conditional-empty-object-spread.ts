import * as Effect from 'effect/Effect'
import { Diagnostic, type ESTree, Rule, RuleContext } from 'effect-oxlint'

const MESSAGE =
  'This conditional spread hides property omission behind an empty object. Build the object in separate statements and add the property only when present.'

function isEmptyObjectLiteral(expression: ESTree.Expression): boolean {
  return expression.type === 'ObjectExpression' && expression.properties.length === 0
}

function omitsThroughEmptyBranch(conditional: ESTree.Expression): boolean {
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
