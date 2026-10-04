import type { ESTree } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'

const LAYER_BINDING = 'Layer'

const PROVIDE = 'provide'

const MESSAGE =
  'A Layer.provide inside another buries which layer satisfies which requirement. Name the inner layer first, or merge the two with Layer.provideMerge.'

function isLayerProvideCall(node: ESTree.Node): boolean {
  if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression') {
    return false
  }

  const { object, property } = node.callee

  return (
    object.type === 'Identifier' &&
    object.name === LAYER_BINDING &&
    property.type === 'Identifier' &&
    property.name === PROVIDE
  )
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid nested Layer.provide calls' },
    messages: { nestedLayerProvide: MESSAGE },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isLayerProvideCall(node)) {
          return
        }

        for (const argument of node.arguments.filter(isLayerProvideCall)) {
          context.report({ node: argument, messageId: 'nestedLayerProvide' })
        }
      },
    }
  },
})
