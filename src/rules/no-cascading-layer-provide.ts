import * as Arr from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Predicate from 'effect/Predicate'
import { Diagnostic, type ESTree, type OxlintSourceCode, Rule, RuleContext } from 'effect-oxlint'
import { isEffectLayerReference } from '../shared/layer-import.ts'

const PIPE = 'pipe'

const PROVISIONING_METHODS = new Set(['provide', 'provideMerge'])

const CASCADING_STAGE_COUNT = 2

const MESSAGE =
  'Each provisioning stage in a pipe rebuilds the layer graph, so a chain of them hides the order in which dependencies are actually satisfied. Provide independent layers together in a single call, and give a configured layer a name before another layer consumes it.'

function namesAProvisioningMethod(property: ESTree.Node): boolean {
  if (property.type === 'Identifier') {
    return PROVISIONING_METHODS.has(property.name)
  }

  return (
    property.type === 'Literal' &&
    Predicate.isString(property.value) &&
    PROVISIONING_METHODS.has(property.value)
  )
}

function isLayerProvision(sourceCode: OxlintSourceCode, argument: ESTree.Node): boolean {
  if (argument.type !== 'CallExpression' || argument.callee.type !== 'MemberExpression') {
    return false
  }

  const { callee } = argument

  return (
    isEffectLayerReference(sourceCode, callee.object) && namesAProvisioningMethod(callee.property)
  )
}

function isPipeCall(node: ESTree.CallExpression): boolean {
  const { callee } = node

  return (
    callee.type === 'MemberExpression' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === PIPE
  )
}

export default Rule.define({
  name: 'no-cascading-layer-provide',
  meta: Rule.meta({
    type: 'problem',
    description: 'forbid multiple Layer.provide stages in one pipe',
    messages: { cascadingLayerProvide: MESSAGE },
  }),
  create: function* () {
    const context = yield* RuleContext

    return {
      CallExpression: (node: ESTree.Node) => {
        if (node.type !== 'CallExpression' || !isPipeCall(node)) {
          return Effect.void
        }

        const stages = Arr.filter(node.arguments, (argument) =>
          isLayerProvision(context.sourceCode, argument),
        )

        return stages.length < CASCADING_STAGE_COUNT
          ? Effect.void
          : context.report(Diagnostic.fromId({ node, messageId: 'cascadingLayerProvide' }))
      },
    }
  },
})
