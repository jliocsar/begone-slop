import type { ESTree, SourceCode } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { EFFECT_ARRAY_BINDING, isEffectArrayReference } from '../shared/effect-array-import.ts'

const STANDARD_ARRAY_STATICS = new Set(['from', 'isArray', 'of'])

const MESSAGE =
  'Array here refers to the Effect module, so a standard static resolves to something else entirely. Reach for globalThis.Array when you want the built-in.'

function readsStandardStatic(sourceCode: SourceCode, node: ESTree.MemberExpression): boolean {
  const { object, property } = node

  return (
    object.type === 'Identifier' &&
    object.name === EFFECT_ARRAY_BINDING &&
    property.type === 'Identifier' &&
    STANDARD_ARRAY_STATICS.has(property.name) &&
    isEffectArrayReference(sourceCode, object)
  )
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid standard Array statics when Array is imported from effect' },
    messages: { shadowedStandardArrayStatic: MESSAGE },
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (readsStandardStatic(context.sourceCode, node)) {
          context.report({ node, messageId: 'shadowedStandardArrayStatic' })
        }
      },
    }
  },
})
