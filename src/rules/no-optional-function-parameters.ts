/**
 * An optional parameter hides a third state behind punctuation: the caller can
 * pass a value, pass `undefined`, or pass nothing, and the signature says which
 * two are the same only by omission. Spelling the union out (`number | undefined`)
 * makes the absent case a value the reader and the compiler both see.
 *
 * One diagnostic per offending parameter, on the parameter itself. Declaration-only
 * signatures (TSMethodSignature, TSFunctionType, TSDeclareFunction) are untouched:
 * those node types are never visited. Default values and optional members of an
 * object-type parameter are not optional parameters and are left alone.
 *
 * Report-only — the replacement type depends on whether absence means `undefined`
 * or `null`.
 */

import * as Arr from 'effect/Array'
import * as Effect from 'effect/Effect'
import { Diagnostic, type ESTree, Rule, RuleContext } from 'effect-oxlint'

/**
 * oxlint's binding-pattern types declare `optional` as `false`, yet the parser
 * emits `true` for `a?: number` (measured), so the flag is read through the shape
 * the parser actually produces. `parameter` is the TSParameterProperty case:
 * `constructor(private readonly a?: string)` puts the flag on the wrapped param.
 */
type PossiblyOptionalParameter = {
  readonly optional?: boolean | undefined
  readonly parameter?: PossiblyOptionalParameter | undefined
}

const MESSAGE =
  'Optional function parameters are banned. Use an explicit union with undefined or null.'

function isOptionalParameter(parameter: PossiblyOptionalParameter): boolean {
  return parameter.optional === true || parameter.parameter?.optional === true
}

function optionalParameterDiagnostics(node: ESTree.Node): readonly Diagnostic.Diagnostic[] {
  if (
    node.type !== 'FunctionDeclaration' &&
    node.type !== 'FunctionExpression' &&
    node.type !== 'ArrowFunctionExpression'
  ) {
    return []
  }

  return Arr.map(Arr.filter(node.params, isOptionalParameter), (parameter) =>
    Diagnostic.fromId({ node: parameter, messageId: 'noOptionalFunctionParameters' }),
  )
}

export default Rule.define({
  name: 'no-optional-function-parameters',
  meta: Rule.meta({
    type: 'problem',
    description: 'forbid optional function parameters in favour of an explicit union',
    messages: { noOptionalFunctionParameters: MESSAGE },
  }),
  create: function* () {
    const context = yield* RuleContext

    const report = (node: ESTree.Node) =>
      Effect.forEach(optionalParameterDiagnostics(node), context.report, { discard: true })

    return {
      FunctionDeclaration: report,
      FunctionExpression: report,
      ArrowFunctionExpression: report,
    }
  },
})
