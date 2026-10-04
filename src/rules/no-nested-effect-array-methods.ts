import type { ESTree, SourceCode } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { isEffectArrayReference } from '../shared/effect-array-import.ts'

const MESSAGE =
  'Nesting one Effect Array call inside another loses the inferred element type at the boundary. Chain the calls through pipe so each step keeps its inference.'

function isEffectArrayMethodCall(
  sourceCode: SourceCode,
  node: ESTree.Node,
): node is ESTree.CallExpression {
  if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression') {
    return false
  }

  const { object, property } = node.callee

  return property.type === 'Identifier' && isEffectArrayReference(sourceCode, object)
}

function enclosingArrayCalls(
  sourceCode: SourceCode,
  descendant: ESTree.Node,
): readonly ESTree.CallExpression[] {
  const { parent } = descendant

  if (parent === null) {
    return []
  }

  const outerCalls = enclosingArrayCalls(sourceCode, parent)
  const nestsTheDescendant =
    isEffectArrayMethodCall(sourceCode, parent) &&
    parent.arguments.some((argument) => argument === descendant)

  return nestsTheDescendant ? [parent, ...outerCalls] : outerCalls
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid nesting one effect Array method call inside another' },
    messages: { nestedEffectArrayMethods: MESSAGE },
  },
  create(context) {
    const { sourceCode } = context
    const reportedCalls = new WeakSet<ESTree.CallExpression>()

    return {
      CallExpression(node) {
        if (!isEffectArrayMethodCall(sourceCode, node)) {
          return
        }

        for (const outerCall of enclosingArrayCalls(sourceCode, node)) {
          if (!reportedCalls.has(outerCall)) {
            reportedCalls.add(outerCall)
            context.report({ node: outerCall, messageId: 'nestedEffectArrayMethods' })
          }
        }
      },
    }
  },
})
