import type { ESTree, SourceCode } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { isEffectLayerReference, pipeStages } from '../shared/layer-import.ts'

const PROVIDE = 'provide'

const MESSAGE =
  'A Layer.provide inside another buries which layer satisfies which requirement. Name the inner layer first, or merge the two with Layer.provideMerge.'

function isLayerProvideCall(sourceCode: SourceCode, node: ESTree.Node): boolean {
  if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression') {
    return false
  }

  const { object, property } = node.callee

  return (
    isEffectLayerReference(sourceCode, object) &&
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
    const { sourceCode } = context

    return {
      CallExpression(node) {
        if (!isLayerProvideCall(sourceCode, node)) {
          return
        }

        const nestedCandidates = node.arguments.flatMap((argument) => [
          argument,
          ...pipeStages(sourceCode, argument),
        ])

        for (const nested of nestedCandidates) {
          if (isLayerProvideCall(sourceCode, nested)) {
            context.report({ node: nested, messageId: 'nestedLayerProvide' })
          }
        }
      },
    }
  },
})
