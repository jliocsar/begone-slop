import { defineRule } from '@oxlint/plugins'
import { effectModuleMemberName } from '../shared/effect-module-import.ts'

const EFFECT_MODULE = 'Effect'

const MEMBER_NAME = 'asVoid'

const MESSAGE =
  'Effect.asVoid throws away a success value the caller may still want. Return the effect unchanged when its success type is already void.'

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
