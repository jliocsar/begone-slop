import * as Arr from 'effect/Array'
import * as Effect from 'effect/Effect'
import { Diagnostic, type ESTree, Rule, RuleContext } from 'effect-oxlint'

const LAYER_BINDING = 'Layer'

const PROVIDE = 'provide'

const MESSAGE =
  'Avoid nested Layer.provide calls. Extract the inner layer or use Layer.provideMerge.'

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

function nestedProvides(node: ESTree.Node): readonly Diagnostic.Diagnostic[] {
  if (node.type !== 'CallExpression' || !isLayerProvideCall(node)) {
    return []
  }

  return Arr.map(Arr.filter(node.arguments, isLayerProvideCall), (argument) =>
    Diagnostic.fromId({ node: argument, messageId: 'nestedLayerProvide' }),
  )
}

export default Rule.define({
  name: 'no-nested-layer-provide',
  meta: Rule.meta({
    type: 'problem',
    description: 'forbid nested Layer.provide calls',
    messages: { nestedLayerProvide: MESSAGE },
  }),
  create: function* () {
    const context = yield* RuleContext

    return {
      CallExpression: (node: ESTree.Node) =>
        Effect.forEach(nestedProvides(node), context.report, { discard: true }),
    }
  },
})
