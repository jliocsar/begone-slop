/**
 * A parameter typed `object` accepts every non-primitive and describes none of
 * them: the function can read nothing off it without asserting first, so the
 * annotation buys type-checking that is not there. Take the named owner type
 * and parse external input at its boundary.
 *
 * `object` counts wherever it reaches the top level of the annotation:
 * directly, through parentheses, as any member of a union, or through a
 * top-level non-generic alias, resolved recursively. A generic alias, an alias
 * reference carrying type arguments and a named object type are all left alone.
 *
 * Report-only — the replacement is the owner's type, which only the author has.
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
  parameterAnnotation,
} from '../shared/function-signature.ts'

type AliasesByName = ReadonlyMap<string, ESTree.TSType>

const PARAMETER_PLACEHOLDER = '{{parameter}}'

/** What a non-identifier pattern's source text ends with when it is `object`. */
const OBJECT_ANNOTATION_SUFFIX = /\s*:\s*object\s*$/u

const MESSAGE_TEMPLATE = `Parameter \`${PARAMETER_PLACEHOLDER}\` uses the broad \`object\` type. Accept a named owner type; parse external input at its boundary before calling this function.`

/**
 * The type name a mapped key or an `infer` binds. Both declare a name without a
 * `typeParameters` list, and both shadow a same-named alias — `no-unknown-returns`
 * deliberately collects neither, which is why this is not in the shared helper.
 */
function boundTypeName(node: ESTree.Node): Option.Option<string> {
  if (node.type === 'TSMappedType') {
    return Option.some(node.key.name)
  }

  if (node.type === 'TSInferType') {
    return Option.some(node.typeParameter.name.name)
  }

  return Option.none()
}

/** Those bindings for every enclosing node, walked outwards to the Program. */
function enclosingBoundTypeNames(node: ESTree.Node): readonly string[] {
  const { parent } = node

  if (parent === null) {
    return []
  }

  return [...Option.toArray(boundTypeName(parent)), ...enclosingBoundTypeNames(parent)]
}

/** Every type name in scope at `node`, any of which shadows a top-level alias. */
function shadowedAliasNames(sourceCode: OxlintSourceCode, node: ESTree.Node): ReadonlySet<string> {
  return new Set([...lexicalTypeParameterNames(sourceCode, node), ...enclosingBoundTypeNames(node)])
}

/**
 * The alias a bare reference names, or none when type arguments are present: an
 * applied generic resolves to its arguments, not to the body written here.
 */
function referencedAliasName(type: ESTree.TSType): Option.Option<string> {
  if (type.type !== 'TSTypeReference' || type.typeName.type !== 'Identifier') {
    return Option.none()
  }

  const applied = Option.fromNullishOr(type.typeArguments).pipe(
    Option.exists((typeArguments) => typeArguments.params.length > 0),
  )

  return applied ? Option.none() : Option.some(type.typeName.name)
}

function resolvesToObject(
  aliases: AliasesByName,
  shadowedAliases: ReadonlySet<string>,
  visited: readonly string[],
  type: ESTree.TSType,
): boolean {
  if (type.type === 'TSObjectKeyword') {
    return true
  }

  // Ported for parity: oxlint 1.77.0 strips redundant parens, so this is inert.
  if (type.type === 'TSParenthesizedType') {
    return resolvesToObject(aliases, shadowedAliases, visited, type.typeAnnotation)
  }

  if (type.type === 'TSUnionType') {
    return Arr.some(type.types, (member) =>
      resolvesToObject(aliases, shadowedAliases, visited, member),
    )
  }

  return referencedAliasName(type).pipe(
    Option.filter((name) => !Arr.contains(visited, name) && !shadowedAliases.has(name)),
    Option.flatMap((name) =>
      Option.fromNullishOr(aliases.get(name)).pipe(
        Option.map((alias) =>
          resolvesToObject(aliases, shadowedAliases, Arr.append(visited, name), alias),
        ),
      ),
    ),
    Option.getOrElse(() => false),
  )
}

/**
 * The name to quote back at the author. Unlike the shared reader, a pattern
 * that is not a bare identifier is quoted as written — parameter properties and
 * defaults included — minus the annotation being complained about.
 */
function parameterLabel(parameter: ESTree.ParamPattern, parameterText: string): string {
  return parameter.type === 'Identifier'
    ? parameter.name
    : parameterText.replace(OBJECT_ANNOTATION_SUFFIX, '')
}

/** Only aliases usable as a stand-in for `object`: a generic one resolves later. */
function topLevelAlias(
  statement: ESTree.Directive | ESTree.Statement,
): Option.Option<ESTree.TSTypeAliasDeclaration> {
  const declaration =
    statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement

  return declaration !== null &&
    declaration.type === 'TSTypeAliasDeclaration' &&
    Predicate.isNullish(declaration.typeParameters)
    ? Option.some(declaration)
    : Option.none()
}

function topLevelAliases(node: ESTree.Node): AliasesByName {
  if (node.type !== 'Program') {
    return new Map()
  }

  return new Map(
    Arr.getSomes(Arr.map(node.body, topLevelAlias)).map((alias) => [
      alias.id.name,
      alias.typeAnnotation,
    ]),
  )
}

function objectParameterDiagnostics(
  sourceCode: OxlintSourceCode,
  aliases: AliasesByName,
  node: ESTree.Node,
): readonly Diagnostic.Diagnostic[] {
  if (!isFunctionSignature(node)) {
    return []
  }

  const shadowedAliases = shadowedAliasNames(sourceCode, node)

  return Arr.getSomes(
    Arr.map(node.params, (parameter) =>
      parameterAnnotation(parameter).pipe(
        Option.map((annotation) => annotation.typeAnnotation),
        Option.filter((type) => resolvesToObject(aliases, shadowedAliases, [], type)),
        Option.map((type) =>
          Diagnostic.make({
            node: type,
            message: MESSAGE_TEMPLATE.replace(
              PARAMETER_PLACEHOLDER,
              parameterLabel(parameter, sourceCode.getText(parameter)),
            ),
          }),
        ),
      ),
    ),
  )
}

export default Rule.define({
  name: 'no-object-parameters',
  meta: Rule.meta({
    type: 'problem',
    description: 'forbid parameters typed object, aliases to it included',
  }),
  create: function* () {
    const context = yield* RuleContext
    // Collected once per file, so a function above its alias resolves too.
    const aliases = yield* Ref.make<AliasesByName>(new Map())

    const report = (node: ESTree.Node) =>
      Ref.get(aliases).pipe(
        Effect.flatMap((known) =>
          Effect.forEach(
            objectParameterDiagnostics(context.sourceCode, known, node),
            context.report,
            { discard: true },
          ),
        ),
      )

    return {
      Program: (node: ESTree.Node) => Ref.set(aliases, topLevelAliases(node)),
      ...onFunctionSignatures(report),
    }
  },
})
