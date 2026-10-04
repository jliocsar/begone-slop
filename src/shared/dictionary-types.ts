import type { ESTree } from '@oxlint/plugins'
import { dictionaryValueTypes } from './dictionary-values.ts'
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

export type UnsafeValue = 'any' | 'empty-object' | 'object' | 'union' | 'unknown'

export type UnsafeDictionary = {
  readonly kind: 'unsafe-dictionary'
  readonly unsafeValue: UnsafeValue
}

function isNeverType(type: ESTree.TSType): boolean {
  return unwrapTransparentType(type).type === 'TSNeverKeyword'
}

function isEffectivelyEmptyMember(member: ESTree.TSSignature): boolean {
  if (member.type !== 'TSPropertySignature' || !member.optional) {
    return false
  }

  const annotation = member.typeAnnotation

  return annotation !== null && annotation !== undefined && isNeverType(annotation.typeAnnotation)
}

function isEffectivelyEmptyTypeLiteral(type: ESTree.TSTypeLiteral): boolean {
  return type.members.length === 0 || type.members.every(isEffectivelyEmptyMember)
}

function isEffectivelyEmptyInterface(
  declarations: readonly ESTree.TSInterfaceDeclaration[],
): boolean {
  const [declaration] = declarations

  if (declarations.length !== 1 || declaration === undefined) {
    return false
  }

  return (
    declaration.extends.length === 0 &&
    (declaration.body.body.length === 0 || declaration.body.body.every(isEffectivelyEmptyMember))
  )
}

function unsafeKeywordValue(type: ESTree.TSType): UnsafeValue | undefined {
  if (type.type === 'TSUnknownKeyword') {
    return 'unknown'
  }

  if (type.type === 'TSAnyKeyword') {
    return 'any'
  }

  if (type.type === 'TSObjectKeyword') {
    return 'object'
  }

  return type.type === 'TSTypeLiteral' && isEffectivelyEmptyTypeLiteral(type)
    ? 'empty-object'
    : undefined
}

function unsafeIntersectionValue(
  members: readonly (UnsafeValue | undefined)[],
): UnsafeValue | undefined {
  if (members.includes('any')) {
    return 'any'
  }

  return members.every((member) => member !== undefined) ? members[0] : undefined
}

function unsafeAliasValue(
  name: string,
  reference: ESTree.TSTypeReference,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  resolvingAliases: ReadonlySet<string>,
): UnsafeValue | undefined {
  const alias = environment.aliases.get(name)

  if (alias === undefined || resolvingAliases.has(name)) {
    return undefined
  }

  const bindings = aliasSubstitution(alias, reference, substitutions)

  if (bindings === undefined) {
    return undefined
  }

  return unsafeDirectValue(
    alias.typeAnnotation,
    environment,
    bindings,
    new Set([...resolvingAliases, name]),
  )
}

function unsafeDeclaredValue(
  name: string,
  reference: ESTree.TSTypeReference,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  resolvingAliases: ReadonlySet<string>,
): UnsafeValue | undefined {
  const declarations = environment.interfaces.get(name)

  if (declarations === undefined) {
    return unsafeAliasValue(name, reference, environment, substitutions, resolvingAliases)
  }

  return isEffectivelyEmptyInterface(declarations) ? 'empty-object' : undefined
}

function unsafeReferenceValue(
  reference: ESTree.TSTypeReference,
  name: string,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  resolvingAliases: ReadonlySet<string>,
): UnsafeValue | undefined {
  if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, environment)) {
    const wrapped = reference.typeArguments?.params[0]

    return wrapped === undefined
      ? undefined
      : unsafeDirectValue(wrapped, environment, substitutions, resolvingAliases)
  }

  const substitution = substitutions.get(name)

  if (substitution === undefined) {
    return unsafeDeclaredValue(name, reference, environment, substitutions, resolvingAliases)
  }

  return isUnappliedReferenceTo(substitution, name)
    ? undefined
    : unsafeDirectValue(substitution, environment, substitutions, resolvingAliases)
}

function unsafeDirectValue(
  type: ESTree.TSType,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  resolvingAliases: ReadonlySet<string>,
): UnsafeValue | undefined {
  const unwrapped = unwrapTransparentType(type)
  const keyword = unsafeKeywordValue(unwrapped)

  if (keyword !== undefined) {
    return keyword
  }

  if (unwrapped.type === 'TSUnionType') {
    return unwrapped.types.some(
      (member) =>
        unsafeDirectValue(member, environment, substitutions, resolvingAliases) !== undefined,
    )
      ? 'union'
      : undefined
  }

  if (unwrapped.type === 'TSIntersectionType') {
    return unsafeIntersectionValue(
      unwrapped.types.map((member) =>
        unsafeDirectValue(member, environment, substitutions, resolvingAliases),
      ),
    )
  }

  if (unwrapped.type !== 'TSTypeReference') {
    return undefined
  }

  const name = typeReferenceName(unwrapped)

  return name === undefined
    ? undefined
    : unsafeReferenceValue(unwrapped, name, environment, substitutions, resolvingAliases)
}

function unsafeDictionary(unsafeValue: UnsafeValue): UnsafeDictionary {
  return { kind: 'unsafe-dictionary', unsafeValue }
}

export function classifyUnsafeDictionaryValue(
  valueType: ESTree.TSType,
  environment: TypeEnvironment,
): UnsafeDictionary | undefined {
  const unsafeValue = unsafeDirectValue(valueType, environment, new Map(), new Set())

  return unsafeValue === undefined ? undefined : unsafeDictionary(unsafeValue)
}

export function classifyUnsafeDictionary(
  type: ESTree.TSType,
  environment: TypeEnvironment,
): UnsafeDictionary | undefined {
  for (const value of dictionaryValueTypes(type, environment, new Map(), new Set())) {
    const unsafeValue = unsafeDirectValue(value.type, environment, value.substitutions, new Set())

    if (unsafeValue !== undefined) {
      return unsafeDictionary(unsafeValue)
    }
  }

  return undefined
}
