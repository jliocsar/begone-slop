import type { ESTree } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { isConstAssertion, isTypeAssertion, type TypeAssertion } from '../shared/type-assertion.ts'

const MESSAGE =
  'This assertion chain discards type evidence. Keep the original precise type, or parse untrusted input at its boundary before narrowing it.'

function isOutermostAssertionInChain(node: TypeAssertion): boolean {
  const { parent } = node

  return !isTypeAssertion(parent) || parent.expression !== node
}

function assertionChain(expression: ESTree.Expression): readonly TypeAssertion[] {
  return isTypeAssertion(expression) ? [expression, ...assertionChain(expression.expression)] : []
}

function isForbiddenAssertionChain(node: TypeAssertion): boolean {
  const chain = assertionChain(node)

  return chain.length > 1 && chain.some((assertion) => !isConstAssertion(assertion))
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid chained type assertions, including parenthesized chains' },
    messages: { chained: MESSAGE },
  },
  create(context) {
    const report = (node: TypeAssertion) => {
      if (isOutermostAssertionInChain(node) && isForbiddenAssertionChain(node)) {
        context.report({ node, messageId: 'chained' })
      }
    }

    return { TSAsExpression: report, TSTypeAssertion: report }
  },
})
