/**
 * A parameter typed `unknown` accepts anything and parses nothing: the caller's
 * value arrives unchecked and every use inside has to re-establish what it is.
 * Parse at the I/O boundary and take the named domain type here.
 *
 * The keyword must be written on the parameter itself — an alias that resolves
 * to `unknown`, `unknown[]`, `Promise<unknown>` and a union containing
 * `unknown` are all left alone, deliberately narrower than `no-unknown-returns`.
 * A parameter named exactly `cause` is the error-enrichment escape hatch.
 *
 * Report-only — the replacement is the parsed type, which only the author has.
 */

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

const PARAMETER_PLACEHOLDER = '{{parameter}}'

/** Error enrichment takes whatever the runtime threw, so it cannot be parsed. */
const CAUSE_PARAMETER = 'cause'

const MESSAGE_TEMPLATE = `Parameter \`${PARAMETER_PLACEHOLDER}\` leaves input unparsed. Accept a named domain type; run the expected schema or parser at the I/O boundary before calling this function.`

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
          Diagnostic.make({
            node: keyword,
            message: MESSAGE_TEMPLATE.replace(PARAMETER_PLACEHOLDER, name),
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
