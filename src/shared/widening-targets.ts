import type { ESTree } from '@oxlint/plugins'
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
    return unwrapped.types.every((member) => isBroadMappedKey(member, environment, substitutions))
  }

  if (unwrapped.type !== 'TSTypeReference') {
    return false
  }

  const name = typeReferenceName(unwrapped)

  if (name === undefined) {
    return false
  }

  const substitution = substitutions.get(name)

  if (substitution !== undefined && !isUnappliedReferenceTo(substitution, name)) {
    return isBroadMappedKey(substitution, environment, substitutions)
  }

  return name === 'PropertyKey' && isBuiltIn(name, environment)
}

function classifyAliasBroadTarget(
  type: ESTree.TSType,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  resolvingAliases: ReadonlySet<string>,
): WideningTarget | undefined {
  const unwrapped = unwrapTransparentType(type)

  if (unwrapped.type === 'TSUnknownKeyword') {
    return wideningTarget('unknown')
  }

  if (unwrapped.type === 'TSObjectKeyword') {
    return wideningTarget('object')
  }

  if (unwrapped.type === 'TSTypeLiteral') {
    return unwrapped.members.some((member) => member.type === 'TSIndexSignature')
      ? wideningTarget('open dictionary')
      : undefined
  }

  if (unwrapped.type === 'TSMappedType') {
    return isBroadMappedKey(unwrapped.constraint, environment, substitutions)
      ? wideningTarget('open dictionary')
      : undefined
  }

  if (unwrapped.type !== 'TSTypeReference') {
    return undefined
  }

  const name = typeReferenceName(unwrapped)

  return name === undefined
    ? undefined
    : aliasBroadTargetOfName(unwrapped, name, environment, substitutions, resolvingAliases)
}

function aliasBroadTargetOfName(
  reference: ESTree.TSTypeReference,
  name: string,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  resolvingAliases: ReadonlySet<string>,
): WideningTarget | undefined {
  const substitution = substitutions.get(name)

  if (substitution !== undefined) {
    return isUnappliedReferenceTo(substitution, name)
      ? undefined
      : classifyAliasBroadTarget(substitution, environment, substitutions, resolvingAliases)
  }

  if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, environment)) {
    const wrapped = reference.typeArguments?.params[0]

    return wrapped === undefined
      ? undefined
      : classifyAliasBroadTarget(wrapped, environment, substitutions, resolvingAliases)
  }

  if (name === 'Record' && isBuiltIn(name, environment)) {
    return wideningTarget('open dictionary')
  }

  const alias = environment.aliases.get(name)

  if (alias === undefined || resolvingAliases.has(name)) {
    return undefined
  }

  const bindings = aliasSubstitution(alias, reference, substitutions)

  if (bindings === undefined) {
    return undefined
  }

  return classifyAliasBroadTarget(
    alias.typeAnnotation,
    environment,
    bindings,
    new Set([...resolvingAliases, name]),
  )
}

function genericContainerTarget(
  alias: ESTree.TSTypeAliasDeclaration,
  reference: ESTree.TSTypeReference,
  environment: TypeEnvironment,
  name: string,
): WideningTarget | undefined {
  const bindings = aliasSubstitution(alias, reference, new Map())

  if (
    bindings === undefined ||
    !resolvesToDictionary(alias.typeAnnotation, environment, bindings, new Set([name]))
  ) {
    return undefined
  }

  return wideningTarget('generic container')
}

function wideningTargetOfName(
  reference: ESTree.TSTypeReference,
  name: string,
  environment: TypeEnvironment,
): WideningTarget | undefined {
  if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, environment)) {
    const wrapped = reference.typeArguments?.params[0]

    return wrapped === undefined ? undefined : classifyWideningTarget(wrapped, environment)
  }

  if (name === 'Record' && isBuiltIn(name, environment)) {
    return wideningTarget('open dictionary')
  }

  const alias = environment.aliases.get(name)

  if (alias === undefined) {
    return undefined
  }

  if ((alias.typeParameters?.params.length ?? 0) > 0) {
    return genericContainerTarget(alias, reference, environment, name)
  }

  const bindings = aliasSubstitution(alias, reference, new Map())

  return bindings === undefined
    ? undefined
    : classifyAliasBroadTarget(alias.typeAnnotation, environment, bindings, new Set([name]))
}

export function classifyWideningTarget(
  type: ESTree.TSType,
  environment: TypeEnvironment,
): WideningTarget | undefined {
  const unwrapped = unwrapTransparentType(type)

  if (unwrapped.type === 'TSUnknownKeyword') {
    return wideningTarget('unknown')
  }

  if (unwrapped.type === 'TSObjectKeyword') {
    return wideningTarget('object')
  }

  if (unwrapped.type === 'TSTypeLiteral') {
    if (unwrapped.members.some((member) => member.type === 'TSIndexSignature')) {
      return wideningTarget('open dictionary')
    }

    return unwrapped.members.length > 0 ? wideningTarget('anonymous object') : undefined
  }

  if (unwrapped.type === 'TSMappedType') {
    return wideningTarget('open dictionary')
  }

  if (unwrapped.type !== 'TSTypeReference') {
    return undefined
  }

  const name = typeReferenceName(unwrapped)

  return name === undefined ? undefined : wideningTargetOfName(unwrapped, name, environment)
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
