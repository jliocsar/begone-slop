/**
 * Two `Layer.provide` stages in one pipe hide the dependency graph: whether the
 * second layer feeds the first or the two are independent is invisible at the
 * call site, and the order is load-bearing either way.
 *
 * Method chaining (`.provide().provide()`) is untouched — only pipe ARGUMENTS
 * count, since that is the shape the fix applies to.
 *
 * Report-only — combining or extracting depends on which the author meant.
 */

import * as Arr from 'effect/Array'
import * as Effect from 'effect/Effect'
import { Diagnostic, type ESTree, type OxlintSourceCode, Rule, RuleContext } from 'effect-oxlint'
import { isEffectLayerReference } from '../shared/layer-import.ts'

const PIPE = 'pipe'

const PROVISIONING_METHODS = new Set(['provide', 'provideMerge'])

/** One provision stage is the intended shape; the second is what cascades. */
const CASCADING_STAGE_COUNT = 2

const MESSAGE =
  'Avoid multiple Layer.provide or Layer.provideMerge stages in one pipe. Combine independent dependencies in one Layer.provide([...]); when a layer depends on another layer, extract and name that configured layer before providing it.'

function namesAProvisioningMethod(property: ESTree.Node): boolean {
  if (property.type === 'Identifier') {
    return PROVISIONING_METHODS.has(property.name)
  }

  return (
    property.type === 'Literal' &&
    typeof property.value === 'string' &&
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
