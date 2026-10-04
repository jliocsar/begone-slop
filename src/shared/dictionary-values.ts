import type { ESTree } from '@oxlint/plugins'
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

export type ResolvedType = {
  readonly type: ESTree.TSType
  readonly substitutions: TypeAliasEnvironment
}

function memberValueTypes(
  members: readonly ESTree.TSSignature[],
  substitutions: TypeAliasEnvironment,
): readonly ResolvedType[] {
  return members.flatMap((member): readonly ResolvedType[] =>
    member.type === 'TSIndexSignature'
      ? [{ type: member.typeAnnotation.typeAnnotation, substitutions }]
      : [],
  )
}

function argumentValueType(
  reference: ESTree.TSTypeReference,
  index: number,
  substitutions: TypeAliasEnvironment,
): readonly ResolvedType[] {
  const type = reference.typeArguments?.params[index]

  return type === undefined ? [] : [{ type, substitutions }]
}

function argumentValueTypes(
  reference: ESTree.TSTypeReference,
  index: number,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  resolvingAliases: ReadonlySet<string>,
): readonly ResolvedType[] {
  const type = reference.typeArguments?.params[index]

  return type === undefined
    ? []
    : dictionaryValueTypes(type, environment, substitutions, resolvingAliases)
}

function builtInValueTypes(
  reference: ESTree.TSTypeReference,
  name: string,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  resolvingAliases: ReadonlySet<string>,
): readonly ResolvedType[] | undefined {
  if (!isBuiltIn(name, environment)) {
    return undefined
  }

  if (TRANSPARENT_WRAPPERS.has(name) || name === 'Pick' || name === 'Omit') {
    return argumentValueTypes(reference, 0, environment, substitutions, resolvingAliases)
  }

  return name === 'Record' ? argumentValueType(reference, 1, substitutions) : undefined
}

function aliasValueTypes(
  name: string,
  reference: ESTree.TSTypeReference,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  resolvingAliases: ReadonlySet<string>,
): readonly ResolvedType[] {
  const alias = environment.aliases.get(name)

  if (alias === undefined || resolvingAliases.has(name)) {
    return []
  }

  const bindings = aliasSubstitution(alias, reference, substitutions)

  if (bindings === undefined) {
    return []
  }

  return dictionaryValueTypes(
    alias.typeAnnotation,
    environment,
    bindings,
    new Set([...resolvingAliases, name]),
  )
}

function referenceValueTypes(
  reference: ESTree.TSTypeReference,
  name: string,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  resolvingAliases: ReadonlySet<string>,
): readonly ResolvedType[] {
  const substitution = substitutions.get(name)

  if (substitution !== undefined) {
    return isUnappliedReferenceTo(substitution, name)
      ? []
      : dictionaryValueTypes(substitution, environment, substitutions, resolvingAliases)
  }

  return (
    builtInValueTypes(reference, name, environment, substitutions, resolvingAliases) ??
    aliasValueTypes(name, reference, environment, substitutions, resolvingAliases)
  )
}

export function dictionaryValueTypes(
  type: ESTree.TSType,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  resolvingAliases: ReadonlySet<string>,
): readonly ResolvedType[] {
  const unwrapped = unwrapTransparentType(type)

  if (unwrapped.type === 'TSTypeLiteral') {
    return memberValueTypes(unwrapped.members, substitutions)
  }

  if (unwrapped.type === 'TSMappedType') {
    const value = unwrapped.typeAnnotation

    return value === null || value === undefined ? [] : [{ type: value, substitutions }]
  }

  if (unwrapped.type !== 'TSTypeReference') {
    return []
  }

  const name = typeReferenceName(unwrapped)

  return name === undefined
    ? []
    : referenceValueTypes(unwrapped, name, environment, substitutions, resolvingAliases)
}

export function resolvesToDictionary(
  type: ESTree.TSType,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  resolvingAliases: ReadonlySet<string>,
): boolean {
  return dictionaryValueTypes(type, environment, substitutions, resolvingAliases).length > 0
}
