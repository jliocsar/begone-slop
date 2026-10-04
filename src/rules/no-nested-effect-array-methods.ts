import type { ESTree } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { EFFECT_ARRAY_BINDING, importsEffectArrayUnaliased } from '../shared/effect-array-import.ts'

const MESSAGE =
  'Nesting one Effect Array call inside another loses the inferred element type at the boundary. Chain the calls through pipe so each step keeps its inference.'

function isEffectArrayMethodCall(node: ESTree.Node): node is ESTree.CallExpression {
  if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression') {
    return false
  }

  const { object, property } = node.callee

  return (
    object.type === 'Identifier' &&
    object.name === EFFECT_ARRAY_BINDING &&
    property.type === 'Identifier'
  )
}

function enclosingArrayCalls(descendant: ESTree.Node): readonly ESTree.CallExpression[] {
  const { parent } = descendant

  if (parent === null) {
    return []
  }

  const outerCalls = enclosingArrayCalls(parent)
  const nestsTheDescendant =
    isEffectArrayMethodCall(parent) && parent.arguments.some((argument) => argument === descendant)

  return nestsTheDescendant ? [parent, ...outerCalls] : outerCalls
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid nesting one effect Array method call inside another' },
    messages: { nestedEffectArrayMethods: MESSAGE },
  },
  create(context) {
    let shadowsTheGlobal = false
    const reportedCalls = new WeakSet<ESTree.CallExpression>()

    return {
      Program(node) {
        shadowsTheGlobal = importsEffectArrayUnaliased(node)
      },
      CallExpression(node) {
        if (!shadowsTheGlobal || !isEffectArrayMethodCall(node)) {
          return
        }

        for (const outerCall of enclosingArrayCalls(node)) {
          if (!reportedCalls.has(outerCall)) {
            reportedCalls.add(outerCall)
            context.report({ node: outerCall, messageId: 'nestedEffectArrayMethods' })
          }
        }
      },
    }
  },
})
