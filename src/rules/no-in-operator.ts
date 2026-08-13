import * as Effect from 'effect/Effect'
import { Diagnostic, type ESTree, Rule, RuleContext } from 'effect-oxlint'

const IN_OPERATOR = 'in'

const MESSAGE =
  'Do not use the "in" operator to check for object keys. Fix or refactor the code so this key check is not needed. Only use Predicate as a last-resort escape hatch.'

export default Rule.define({
  name: 'no-in-operator',
  meta: Rule.meta({
    type: 'problem',
    description: 'forbid the `in` operator as an object key check',
    messages: { noInOperator: MESSAGE },
  }),
  create: function* () {
    const context = yield* RuleContext

    return {
      BinaryExpression: (node: ESTree.Node) =>
        node.type === 'BinaryExpression' && node.operator === IN_OPERATOR
          ? context.report(Diagnostic.fromId({ node, messageId: 'noInOperator' }))
          : Effect.void,
    }
  },
})
