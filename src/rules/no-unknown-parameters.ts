import * as Arr from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import { Diagnostic, type ESTree, type OxlintSourceCode, Rule, RuleContext } from 'effect-oxlint'
import {
  isFunctionSignature,
  onFunctionSignatures,
  parameterAnnotation,
  parameterName,
} from '../shared/function-signature.ts'

const CAUSE_PARAMETER = 'cause'

const MESSAGE =
  'Parameter `{{parameter}}` leaves input unparsed. Accept a named domain type; run the expected schema or parser at the I/O boundary before calling this function.'

function unknownKeyword(parameter: ESTree.ParamPattern): Option.Option<ESTree.TSType> {
  return parameterAnnotation(parameter).pipe(
    Option.map((annotation) => annotation.typeAnnotation),
    Option.filter((type) => type.type === 'TSUnknownKeyword'),
  )
}

function unknownParameterDiagnostics(
  sourceCode: OxlintSourceCode,
  node: ESTree.Node,
): readonly Diagnostic.Diagnostic[] {
  if (!isFunctionSignature(node)) {
    return []
  }

  return Arr.getSomes(
    Arr.map(node.params, (parameter) =>
      unknownKeyword(parameter).pipe(
        Option.map((keyword) => ({
          keyword,
          name: parameterName(parameter, sourceCode.getText(parameter)),
        })),
        Option.filter(({ name }) => name !== CAUSE_PARAMETER),
        Option.map(({ keyword, name }) =>
          Diagnostic.fromId({
            node: keyword,
            messageId: 'unknownParameter',
            data: { parameter: name },
          }),
        ),
      ),
    ),
  )
}

export default Rule.define({
  name: 'no-unknown-parameters',
  meta: Rule.meta({
    type: 'problem',
    description: 'forbid parameters annotated unknown, except one named cause',
    messages: { unknownParameter: MESSAGE },
  }),
  create: function* () {
    const context = yield* RuleContext

    return onFunctionSignatures((node: ESTree.Node) =>
      Effect.forEach(unknownParameterDiagnostics(context.sourceCode, node), context.report, {
        discard: true,
      }),
    )
  },
})
