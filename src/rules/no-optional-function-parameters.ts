import type { ESTree } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'

type PossiblyOptionalParameter = {
  readonly optional?: boolean | undefined
  readonly parameter?: PossiblyOptionalParameter | undefined
}

const MESSAGE =
  'An optional parameter leaves the caller unable to distinguish absence from a value never passed. Take the parameter explicitly and widen its type with undefined or null.'

function isOptionalParameter(parameter: PossiblyOptionalParameter): boolean {
  return parameter.optional === true || parameter.parameter?.optional === true
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid optional function parameters in favour of an explicit union' },
    messages: { noOptionalFunctionParameters: MESSAGE },
  },
  create(context) {
    function reportOptionalParameters(node: ESTree.ArrowFunctionExpression | ESTree.Function) {
      for (const parameter of node.params) {
        if (isOptionalParameter(parameter)) {
          context.report({ node: parameter, messageId: 'noOptionalFunctionParameters' })
        }
      }
    }

    return {
      FunctionDeclaration: reportOptionalParameters,
      FunctionExpression: reportOptionalParameters,
      ArrowFunctionExpression: reportOptionalParameters,
    }
  },
})
