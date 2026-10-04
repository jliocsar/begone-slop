import type { ESTree } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import {
  type FunctionSignatureNode,
  onFunctionSignatures,
  parameterAnnotation,
  parameterName,
} from '../shared/function-signature.ts'

const CAUSE_PARAMETER = 'cause'

const MESSAGE =
  'Parameter `{{parameter}}` leaves input unparsed. Accept a named domain type; run the expected schema or parser at the I/O boundary before calling this function.'

function unknownKeyword(parameter: ESTree.ParamPattern): ESTree.TSType | undefined {
  const type = parameterAnnotation(parameter)?.typeAnnotation

  return type?.type === 'TSUnknownKeyword' ? type : undefined
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid parameters annotated unknown, except one named cause' },
    messages: { unknownParameter: MESSAGE },
  },
  create(context) {
    function reportUnknownParameters(node: FunctionSignatureNode) {
      for (const parameter of node.params) {
        const keyword = unknownKeyword(parameter)

        if (keyword === undefined) {
          continue
        }

        const name = parameterName(parameter, context.sourceCode.getText(parameter))

        if (name !== CAUSE_PARAMETER) {
          context.report({
            node: keyword,
            messageId: 'unknownParameter',
            data: { parameter: name },
          })
        }
      }
    }

    return onFunctionSignatures(reportUnknownParameters)
  },
})
