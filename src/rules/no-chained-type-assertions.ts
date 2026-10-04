import type { ESTree } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { isNodeOfType } from '../shared/node-type.ts'
import { isConstAssertion, isTypeAssertion, type TypeAssertion } from '../shared/type-assertion.ts'

type ChainWrapper =
  | ESTree.TSNonNullExpression
  | ESTree.TSSatisfiesExpression
  | ESTree.ParenthesizedExpression

const MESSAGE =
  'This assertion chain discards type evidence. Keep the original precise type, or parse untrusted input at its boundary before narrowing it.'

function isChainWrapper(node: ESTree.Node): node is ChainWrapper {
  return isNodeOfType(node, [
    'TSNonNullExpression',
    'TSSatisfiesExpression',
    'ParenthesizedExpression',
  ])
}

function isOutermostAssertionInChain(node: TypeAssertion | ChainWrapper): boolean {
  const { parent } = node

  if (isChainWrapper(parent) && parent.expression === node) {
    return isOutermostAssertionInChain(parent)
  }

  return !isTypeAssertion(parent) || parent.expression !== node
}

function assertionChain(expression: ESTree.Expression): readonly TypeAssertion[] {
  if (isChainWrapper(expression)) {
    return assertionChain(expression.expression)
  }

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
