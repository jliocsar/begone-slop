import type { SourceCode } from '@oxlint/plugins'
import type { ESTree } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { isKnownArray, methodCall } from '../shared/array-method.ts'

type AdjacentPasses = {
  readonly first: string
  readonly second: string
}

const FILTER = 'filter'
const MAP = 'map'

const MESSAGE =
  'A `{{first}}` followed by a `{{second}}` walks the array twice and builds a throwaway array in between. Do it in one pass: a `flatMap` that returns `[]` to drop an element, or lazy iterator helpers (`.values().{{first}}(…).{{second}}(…).toArray()`).'

const PARTNER_PASSES = new Map([
  [FILTER, MAP],
  [MAP, FILTER],
])

function adjacentPasses(
  sourceCode: SourceCode,
  node: ESTree.CallExpression,
): AdjacentPasses | undefined {
  const outer = methodCall(node)
  const partner = outer === undefined ? undefined : PARTNER_PASSES.get(outer.name)
  const inner = outer === undefined ? undefined : methodCall(outer.receiver)

  if (
    outer === undefined ||
    inner === undefined ||
    inner.name !== partner ||
    !isKnownArray(sourceCode, inner.receiver, new Set())
  ) {
    return undefined
  }

  return { first: inner.name, second: outer.name }
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid a filter and a map pass back to back over a known array' },
    messages: { arrayFilterMap: MESSAGE },
  },
  create(context) {
    return {
      CallExpression(node) {
        const passes = adjacentPasses(context.sourceCode, node)

        if (passes !== undefined) {
          context.report({ node, messageId: 'arrayFilterMap', data: passes })
        }
      },
    }
  },
})
