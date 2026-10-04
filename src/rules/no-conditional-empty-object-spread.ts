import type { ESTree } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'

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

export default defineRule({
  meta: {
    type: 'suggestion',
    docs: { description: 'forbid object spreads that omit a field by spreading an empty object' },
    messages: { noConditionalEmptyObjectSpread: MESSAGE },
  },
  create(context) {
    return {
      SpreadElement(node) {
        if (node.parent.type === 'ObjectExpression' && omitsThroughEmptyBranch(node.argument)) {
          context.report({ node, messageId: 'noConditionalEmptyObjectSpread' })
        }
      },
    }
  },
})
