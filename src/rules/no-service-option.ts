import type { Rule } from '@oxlint/plugins'

const OBJECT_NAME = 'Effect'

const MEMBER_NAME = 'serviceOption'

const MESSAGE =
  'Effect.serviceOption turns a missing dependency into a runtime Option the type system stops tracking. Require the service directly and supply it when building the layer.'

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
