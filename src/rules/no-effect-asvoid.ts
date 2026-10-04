import type { Rule } from '@oxlint/plugins'

const OBJECT_NAME = 'Effect'

const MEMBER_NAME = 'asVoid'

const MESSAGE =
  'Effect.asVoid throws away a success value the caller may still want. Return the effect unchanged when its success type is already void.'

export default {
  meta: { type: 'problem', docs: { description: MESSAGE } },
  create(context) {
    return {
      MemberExpression(node) {
        if (
          !node.computed &&
          node.object.type === 'Identifier' &&
          node.object.name === OBJECT_NAME &&
          node.property.type === 'Identifier' &&
          node.property.name === MEMBER_NAME
        ) {
          context.report({ node, message: MESSAGE })
        }
      },
    }
  },
} satisfies Rule
