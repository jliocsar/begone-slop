import * as Effect from 'effect/Effect'
import * as Ref from 'effect/Ref'
import { Diagnostic, type ESTree, Rule, RuleContext } from 'effect-oxlint'
import { EFFECT_ARRAY_BINDING, importsEffectArrayUnaliased } from '../shared/effect-array-import.ts'

const STANDARD_ARRAY_STATICS = new Set(['from', 'isArray', 'of'])

const MESSAGE =
  'Array is imported from effect in this file. Use globalThis.Array for standard Array static APIs.'

function readsStandardStatic(node: ESTree.Node): boolean {
  if (node.type !== 'MemberExpression') {
    return false
  }

  const { object, property } = node

  return (
    object.type === 'Identifier' &&
    object.name === EFFECT_ARRAY_BINDING &&
    property.type === 'Identifier' &&
    STANDARD_ARRAY_STATICS.has(property.name)
  )
}

export default Rule.define({
  name: 'no-shadowed-standard-array-static',
  meta: Rule.meta({
    type: 'problem',
    description: 'forbid standard Array statics when Array is imported from effect',
    messages: { shadowedStandardArrayStatic: MESSAGE },
  }),
  create: function* () {
    const context = yield* RuleContext
    const shadowsTheGlobal = yield* Ref.make(false)

    return {
      Program: (node: ESTree.Node) => Ref.set(shadowsTheGlobal, importsEffectArrayUnaliased(node)),
      MemberExpression: (node: ESTree.Node) =>
        Effect.flatMap(Ref.get(shadowsTheGlobal), (shadowed) =>
          shadowed && readsStandardStatic(node)
            ? context.report(Diagnostic.fromId({ node, messageId: 'shadowedStandardArrayStatic' }))
            : Effect.void,
        ),
    }
  },
})
