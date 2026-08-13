import * as Arr from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Predicate from 'effect/Predicate'
import * as Ref from 'effect/Ref'
import { Diagnostic, type ESTree, type OxlintSourceCode, Rule, RuleContext } from 'effect-oxlint'
import {
  isFunctionSignature,
  lexicalTypeParameterNames,
  onFunctionSignatures,
} from '../shared/function-signature.ts'

type AliasesByName = ReadonlyMap<string, ESTree.TSTypeAliasDeclaration>

const PROMISE_TYPE_NAMES = new Set(['Promise', 'PromiseLike'])

const MESSAGE =
  'This function exposes `unknown` to its caller. Parse the value at its boundary and return a named domain type.'

function referencedAliasName(type: ESTree.TSType): Option.Option<string> {
  if (type.type !== 'TSTypeReference' || type.typeName.type !== 'Identifier') {
    return Option.none()
  }

  const applied = Option.fromNullishOr(type.typeArguments).pipe(
    Option.exists((typeArguments) => typeArguments.params.length > 0),
  )

  return applied ? Option.none() : Option.some(type.typeName.name)
}

function resolvesToUnknown(
  aliases: AliasesByName,
  shadowedAliases: ReadonlySet<string>,
  visited: readonly string[],
  type: ESTree.TSType,
): boolean {
  if (type.type === 'TSUnknownKeyword') {
    return true
  }

  if (type.type === 'TSUnionType') {
    return Arr.some(type.types, (member) =>
      resolvesToUnknown(aliases, shadowedAliases, visited, member),
    )
  }

  if (
    type.type === 'TSTypeReference' &&
    type.typeName.type === 'Identifier' &&
    PROMISE_TYPE_NAMES.has(type.typeName.name)
  ) {
    return Option.fromNullishOr(type.typeArguments?.params[0]).pipe(
      Option.exists((value) => resolvesToUnknown(aliases, shadowedAliases, visited, value)),
    )
  }

  return referencedAliasName(type).pipe(
    Option.filter((name) => !Arr.contains(visited, name) && !shadowedAliases.has(name)),
    Option.flatMap((name) =>
      Option.fromNullishOr(aliases.get(name)).pipe(
        Option.filter((alias) => Predicate.isNullish(alias.typeParameters)),
        Option.map((alias) =>
          resolvesToUnknown(
            aliases,
            shadowedAliases,
            Arr.append(visited, name),
            alias.typeAnnotation,
          ),
        ),
      ),
    ),
    Option.getOrElse(() => false),
  )
}

function topLevelAlias(
  statement: ESTree.Directive | ESTree.Statement,
): Option.Option<ESTree.TSTypeAliasDeclaration> {
  const declaration =
    statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement

  return declaration !== null && declaration.type === 'TSTypeAliasDeclaration'
    ? Option.some(declaration)
    : Option.none()
}

function topLevelAliases(node: ESTree.Node): AliasesByName {
  if (node.type !== 'Program') {
    return new Map()
  }

  return new Map(
    Arr.getSomes(Arr.map(node.body, topLevelAlias)).map((alias) => [alias.id.name, alias]),
  )
}

function unknownReturnDiagnostic(
  sourceCode: OxlintSourceCode,
  aliases: AliasesByName,
  node: ESTree.Node,
): Option.Option<Diagnostic.Diagnostic> {
  if (!isFunctionSignature(node)) {
    return Option.none()
  }

  return Option.fromNullishOr(node.returnType).pipe(
    Option.map((annotation) => annotation.typeAnnotation),
    Option.filter((type) =>
      resolvesToUnknown(aliases, lexicalTypeParameterNames(sourceCode, node), [], type),
    ),
    Option.map((type) => Diagnostic.fromId({ node: type, messageId: 'unknownReturn' })),
  )
}

export default Rule.define({
  name: 'no-unknown-returns',
  meta: Rule.meta({
    type: 'problem',
    description: 'forbid functions whose return contract resolves to unknown',
    messages: { unknownReturn: MESSAGE },
  }),
  create: function* () {
    const context = yield* RuleContext
    const aliases = yield* Ref.make<AliasesByName>(new Map())

    const report = (node: ESTree.Node) =>
      Ref.get(aliases).pipe(
        Effect.flatMap((known) =>
          Option.match(unknownReturnDiagnostic(context.sourceCode, known, node), {
            onNone: () => Effect.void,
            onSome: context.report,
          }),
        ),
      )

    return {
      Program: (node: ESTree.Node) => Ref.set(aliases, topLevelAliases(node)),
      ...onFunctionSignatures(report),
    }
  },
})
