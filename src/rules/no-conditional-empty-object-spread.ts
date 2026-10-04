import type { ESTree } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'

const MESSAGE =
  'This conditional spread hides property omission behind an empty object. Build the object in separate statements and add the property only when present.'

function unwrapped(expression: ESTree.Expression): ESTree.Expression {
  if (
    expression.type === 'TSAsExpression' ||
    expression.type === 'TSSatisfiesExpression' ||
    expression.type === 'ParenthesizedExpression'
  ) {
    return unwrapped(expression.expression)
  }

  return expression
}

function isEmptyObjectLiteral(expression: ESTree.Expression): boolean {
  return expression.type === 'ObjectExpression' && expression.properties.length === 0
}

function omitsThroughEmptyBranch(expression: ESTree.Expression): boolean {
  const conditional = unwrapped(expression)

  if (conditional.type !== 'ConditionalExpression') {
    return false
  }

  return [conditional.consequent, conditional.alternate].some(
    (branch) => isEmptyObjectLiteral(unwrapped(branch)) || omitsThroughEmptyBranch(branch),
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
      JSXSpreadAttribute(node) {
        if (omitsThroughEmptyBranch(node.argument)) {
          context.report({ node, messageId: 'noConditionalEmptyObjectSpread' })
        }
      },
    }
  },
})
