import * as Arr from 'effect/Array'
import * as Option from 'effect/Option'
import type { ESTree } from 'effect-oxlint'
import { resolvesToDictionary } from './dictionary-values.ts'
import {
  aliasSubstitution,
  isBuiltIn,
  isUnappliedReferenceTo,
  TRANSPARENT_WRAPPERS,
  type TypeAliasEnvironment,
  type TypeEnvironment,
  typeReferenceName,
  unwrapTransparentType,
} from './type-environment.ts'

export type WideningTargetKind =
  | 'anonymous object'
  | 'generic container'
  | 'object'
  | 'open dictionary'
  | 'unknown'

export type WideningTarget = {
  readonly kind: WideningTargetKind
}

const BROAD_KEY_KEYWORDS = new Set(['TSStringKeyword', 'TSNumberKeyword', 'TSSymbolKeyword'])

const EVIDENCE_EXPRESSIONS = new Set([
  'ArrayExpression',
  'ArrowFunctionExpression',
  'ClassExpression',
  'FunctionExpression',
  'Literal',
  'NewExpression',
  'ObjectExpression',
  'TemplateLiteral',
  'UnaryExpression',
])

function wideningTarget(kind: WideningTargetKind): WideningTarget {
  return { kind }
}

function isBroadMappedKey(
  type: ESTree.TSType,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
): boolean {
  const unwrapped = unwrapTransparentType(type)

  if (BROAD_KEY_KEYWORDS.has(unwrapped.type)) {
    return true
  }

  if (unwrapped.type === 'TSUnionType') {
    return Arr.every(unwrapped.types, (member) =>
      isBroadMappedKey(member, environment, substitutions),
    )
  }

  if (unwrapped.type !== 'TSTypeReference') {
    return false
  }

  return typeReferenceName(unwrapped).pipe(
    Option.map((name) =>
      Option.fromNullishOr(substitutions.get(name)).pipe(
        Option.filter((substitution) => !isUnappliedReferenceTo(substitution, name)),
        Option.map((substitution) => isBroadMappedKey(substitution, environment, substitutions)),
        Option.getOrElse(() => name === 'PropertyKey' && isBuiltIn(name, environment)),
      ),
    ),
    Option.getOrElse(() => false),
  )
}

function classifyAliasBroadTarget(
  type: ESTree.TSType,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  resolvingAliases: ReadonlySet<string>,
): Option.Option<WideningTarget> {
  const unwrapped = unwrapTransparentType(type)

  if (unwrapped.type === 'TSUnknownKeyword') {
    return Option.some(wideningTarget('unknown'))
  }

  if (unwrapped.type === 'TSObjectKeyword') {
    return Option.some(wideningTarget('object'))
  }

  if (unwrapped.type === 'TSTypeLiteral') {
    return Arr.some(unwrapped.members, (member) => member.type === 'TSIndexSignature')
      ? Option.some(wideningTarget('open dictionary'))
      : Option.none()
  }

  if (unwrapped.type === 'TSMappedType') {
    return isBroadMappedKey(unwrapped.constraint, environment, substitutions)
      ? Option.some(wideningTarget('open dictionary'))
      : Option.none()
  }

  if (unwrapped.type !== 'TSTypeReference') {
    return Option.none()
  }

  return Option.flatMap(typeReferenceName(unwrapped), (name) =>
    aliasBroadTargetOfName(unwrapped, name, environment, substitutions, resolvingAliases),
  )
}

function aliasBroadTargetOfName(
  reference: ESTree.TSTypeReference,
  name: string,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  resolvingAliases: ReadonlySet<string>,
): Option.Option<WideningTarget> {
  const substitution = Option.fromNullishOr(substitutions.get(name))

  if (Option.isSome(substitution)) {
    return isUnappliedReferenceTo(substitution.value, name)
      ? Option.none()
      : classifyAliasBroadTarget(substitution.value, environment, substitutions, resolvingAliases)
  }

  if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, environment)) {
    return Option.flatMap(Option.fromNullishOr(reference.typeArguments?.params[0]), (wrapped) =>
      classifyAliasBroadTarget(wrapped, environment, substitutions, resolvingAliases),
    )
  }

  if (name === 'Record' && isBuiltIn(name, environment)) {
    return Option.some(wideningTarget('open dictionary'))
  }

  return Option.fromNullishOr(environment.aliases.get(name)).pipe(
    Option.filter(() => !resolvingAliases.has(name)),
    Option.flatMap((alias) =>
      Option.flatMap(aliasSubstitution(alias, reference, substitutions), (bindings) =>
        classifyAliasBroadTarget(
          alias.typeAnnotation,
          environment,
          bindings,
          new Set([...resolvingAliases, name]),
        ),
      ),
    ),
  )
}

function genericContainerTarget(
  alias: ESTree.TSTypeAliasDeclaration,
  reference: ESTree.TSTypeReference,
  environment: TypeEnvironment,
  name: string,
): Option.Option<WideningTarget> {
  return aliasSubstitution(alias, reference, new Map()).pipe(
    Option.filter((bindings) =>
      resolvesToDictionary(alias.typeAnnotation, environment, bindings, new Set([name])),
    ),
    Option.map(() => wideningTarget('generic container')),
  )
}

function wideningTargetOfName(
  reference: ESTree.TSTypeReference,
  name: string,
  environment: TypeEnvironment,
): Option.Option<WideningTarget> {
  if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, environment)) {
    return Option.flatMap(Option.fromNullishOr(reference.typeArguments?.params[0]), (wrapped) =>
      classifyWideningTarget(wrapped, environment),
    )
  }

  if (name === 'Record' && isBuiltIn(name, environment)) {
    return Option.some(wideningTarget('open dictionary'))
  }

  return Option.flatMap(Option.fromNullishOr(environment.aliases.get(name)), (alias) =>
    (alias.typeParameters?.params.length ?? 0) > 0
      ? genericContainerTarget(alias, reference, environment, name)
      : Option.flatMap(aliasSubstitution(alias, reference, new Map()), (bindings) =>
          classifyAliasBroadTarget(alias.typeAnnotation, environment, bindings, new Set([name])),
        ),
  )
}

export function classifyWideningTarget(
  type: ESTree.TSType,
  environment: TypeEnvironment,
): Option.Option<WideningTarget> {
  const unwrapped = unwrapTransparentType(type)

  if (unwrapped.type === 'TSUnknownKeyword') {
    return Option.some(wideningTarget('unknown'))
  }

  if (unwrapped.type === 'TSObjectKeyword') {
    return Option.some(wideningTarget('object'))
  }

  if (unwrapped.type === 'TSTypeLiteral') {
    return Arr.some(unwrapped.members, (member) => member.type === 'TSIndexSignature')
      ? Option.some(wideningTarget('open dictionary'))
      : Option.map(Arr.head(unwrapped.members), () => wideningTarget('anonymous object'))
  }

  if (unwrapped.type === 'TSMappedType') {
    return Option.some(wideningTarget('open dictionary'))
  }

  if (unwrapped.type !== 'TSTypeReference') {
    return Option.none()
  }

  return Option.flatMap(typeReferenceName(unwrapped), (name) =>
    wideningTargetOfName(unwrapped, name, environment),
  )
}

export function isKnownEvidenceExpression(expression: ESTree.Expression): boolean {
  if (
    expression.type === 'TSAsExpression' ||
    expression.type === 'TSTypeAssertion' ||
    expression.type === 'TSNonNullExpression' ||
    expression.type === 'TSSatisfiesExpression'
  ) {
    return isKnownEvidenceExpression(expression.expression)
  }

  return EVIDENCE_EXPRESSIONS.has(expression.type)
}
