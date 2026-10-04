import type { ESTree, SourceCode } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { isEffectArrayReference } from '../shared/effect-array-import.ts'
import { pipeStages } from '../shared/layer-import.ts'

const MESSAGE =
  'Passing one Effect Array call as the data argument of another loses the inferred element type at the boundary. Chain the calls through pipe so each step keeps its inference.'

const FUNCTION_BOUNDARIES = new Set([
  'ArrowFunctionExpression',
  'FunctionExpression',
  'FunctionDeclaration',
])

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

function isPipeStage(sourceCode: SourceCode, call: ESTree.CallExpression): boolean {
  const { parent } = call

  return parent !== null && pipeStages(sourceCode, parent).includes(call)
}

function enclosingArrayCalls(
  sourceCode: SourceCode,
  descendant: ESTree.Node,
): readonly ESTree.CallExpression[] {
  const { parent } = descendant

  if (parent === null || FUNCTION_BOUNDARIES.has(parent.type)) {
    return []
  }

  const outerCalls = enclosingArrayCalls(sourceCode, parent)
  const nestsTheDescendant =
    isEffectArrayMethodCall(sourceCode, parent) &&
    parent.arguments[0] === descendant &&
    !isPipeStage(sourceCode, parent)

  return nestsTheDescendant ? [parent, ...outerCalls] : outerCalls
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: "forbid an effect Array call in another one's data argument" },
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
