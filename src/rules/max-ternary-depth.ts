import type { ESTree, Options } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import {
  outermostTransparentWrapper,
  unwrapTransparentExpression,
} from '../shared/transparent-expression.ts'

type TernaryDepthOptions = {
  readonly maxDepth: number
}

const DEFAULT_MAX_DEPTH = 2

const MESSAGE =
  'This ternary nests {{depth}} deep, past the limit of {{maxDepth}}. Name the decision instead: a lookup, a `Match`, or a function that returns early.'

function configuredMaxDepth(options: Readonly<Options>): number {
  // SAFETY: oxlint validates configured options against meta.schema before create runs
  const configured = options[0] as Partial<TernaryDepthOptions> | undefined

  return configured?.maxDepth ?? DEFAULT_MAX_DEPTH
}

function ternaryDepth(node: ESTree.Node): number {
  const expression = unwrapTransparentExpression(node)

  if (expression.type !== 'ConditionalExpression') {
    return 0
  }

  const deepestBranch = Math.max(
    ternaryDepth(expression.test),
    ternaryDepth(expression.consequent),
    ternaryDepth(expression.alternate),
  )

  return deepestBranch + 1
}

function isNestedTernary(node: ESTree.ConditionalExpression): boolean {
  return outermostTransparentWrapper(node).parent?.type === 'ConditionalExpression'
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'limit how deep ternaries nest, two levels by default' },
    messages: { maxTernaryDepth: MESSAGE },
    schema: [
      {
        type: 'object',
        properties: { maxDepth: { type: 'integer', minimum: 1 } },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const maxDepth = configuredMaxDepth(context.options)

    return {
      ConditionalExpression(node) {
        if (isNestedTernary(node)) {
          return
        }

        const depth = ternaryDepth(node)

        if (depth > maxDepth) {
          context.report({ node, messageId: 'maxTernaryDepth', data: { depth, maxDepth } })
        }
      },
    }
  },
})
