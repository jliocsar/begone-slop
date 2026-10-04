import { defineRule } from '@oxlint/plugins'

const IN_OPERATOR = 'in'

const MESSAGE =
  'Do not use the "in" operator to check for object keys. Fix or refactor the code so this key check is not needed. Only use Predicate as a last-resort escape hatch.'

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid the `in` operator as an object key check' },
    messages: { noInOperator: MESSAGE },
  },
  create(context) {
    return {
      BinaryExpression(node) {
        if (node.operator === IN_OPERATOR) {
          context.report({ node, messageId: 'noInOperator' })
        }
      },
    }
  },
})
