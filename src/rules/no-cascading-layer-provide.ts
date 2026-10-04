import type { ESTree, SourceCode } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { isEffectLayerReference, pipeStages } from '../shared/layer-import.ts'
import { stringLiteralValue } from '../shared/literal.ts'

const PROVISIONING_METHODS = new Set(['provide', 'provideMerge'])
const CASCADING_STAGE_COUNT = 2

const MESSAGE =
  'Each provisioning stage in a pipe rebuilds the layer graph, so a chain of them hides the order in which dependencies are actually satisfied. Provide independent layers together in a single call, and give a configured layer a name before another layer consumes it.'

function namesAProvisioningMethod(property: ESTree.Node): boolean {
  if (property.type === 'Identifier') {
    return PROVISIONING_METHODS.has(property.name)
  }

  const literalName = stringLiteralValue(property)

  return literalName !== undefined && PROVISIONING_METHODS.has(literalName)
}

function isLayerProvision(sourceCode: SourceCode, argument: ESTree.Node): boolean {
  if (argument.type !== 'CallExpression' || argument.callee.type !== 'MemberExpression') {
    return false
  }

  const { callee } = argument

  return (
    isEffectLayerReference(sourceCode, callee.object) && namesAProvisioningMethod(callee.property)
  )
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid multiple Layer.provide stages in one pipe' },
    messages: { cascadingLayerProvide: MESSAGE },
  },
  create(context) {
    return {
      CallExpression(node) {
        const stages = pipeStages(context.sourceCode, node).filter((argument) =>
          isLayerProvision(context.sourceCode, argument),
        )

        if (stages.length >= CASCADING_STAGE_COUNT) {
          context.report({ node, messageId: 'cascadingLayerProvide' })
        }
      },
    }
  },
})
