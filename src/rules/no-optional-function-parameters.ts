import * as Arr from 'effect/Array'
import * as Effect from 'effect/Effect'
import { Diagnostic, type ESTree, Rule, RuleContext } from 'effect-oxlint'

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
