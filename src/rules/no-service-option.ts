import { defineRule } from '@oxlint/plugins'
import { effectModuleMemberName } from '../shared/effect-module-import.ts'

const EFFECT_MODULE = 'Effect'

const MEMBER_NAME = 'serviceOption'

const MESSAGE =
  'Effect.serviceOption turns a missing dependency into a runtime Option the type system stops tracking. Require the service directly and supply it when building the layer.'

export default defineRule({
  meta: { type: 'problem', docs: { description: MESSAGE } },
  create(context) {
    return {
      MemberExpression(node) {
        if (effectModuleMemberName(context.sourceCode, node, EFFECT_MODULE) === MEMBER_NAME) {
          context.report({ node, message: MESSAGE })
        }
      },
    }
  },
})
