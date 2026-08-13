/**
 * A return contract of `unknown` hands the caller a value it cannot use until
 * it re-parses it, which is the parsing the function itself skipped. Parse at
 * the boundary and return the named domain type.
 *
 * `unknown` counts wherever it reaches the top level of the contract: directly,
 * through parentheses, as any member of a union, inside `Promise`/`PromiseLike`
 * (matched by NAME — a locally shadowed `Promise` still counts), or through a
 * top-level non-generic alias, resolved recursively. Nested in an object or a
 * property (`(): { cause: unknown }`) it is a field, not the contract, and is
 * left alone; so is a generic parameter that shadows an alias name.
 *
 * Report-only — the replacement is the parsed type, which only the author has.
 */

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

/** Awaiting one of these yields its first type argument, so it is transparent. */
const PROMISE_TYPE_NAMES = new Set(['Promise', 'PromiseLike'])

const MESSAGE =
  'This function exposes `unknown` to its caller. Parse the value at its boundary and return a named domain type.'

/**
 * The alias a bare reference names, or none when type arguments are present: an
 * applied generic resolves to its arguments, not to the body written here.
 */
function referencedAliasName(type: ESTree.TSType): Option.Option<string> {
  if (type.type === 'TSParenthesizedType') {
    return referencedAliasName(type.typeAnnotation)
  }

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

  if (type.type === 'TSParenthesizedType') {
    return resolvesToUnknown(aliases, shadowedAliases, visited, type.typeAnnotation)
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
    Option.map((type) => Diagnostic.make({ node: type, message: MESSAGE })),
  )
}

export default Rule.define({
  name: 'no-unknown-returns',
  meta: Rule.meta({
    type: 'problem',
    description: 'forbid functions whose return contract resolves to unknown',
  }),
  create: function* () {
    const context = yield* RuleContext
    // Collected once per file, so a function above its alias resolves too.
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
