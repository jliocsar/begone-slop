import * as Arr from 'effect/Array'
import * as Option from 'effect/Option'
import type { ESTree } from 'effect-oxlint'
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
  return Arr.getSomes(
    Arr.map(members, (member) =>
      member.type === 'TSIndexSignature'
        ? Option.some<ResolvedType>({ type: member.typeAnnotation.typeAnnotation, substitutions })
        : Option.none(),
    ),
  )
}

function argumentValueType(
  reference: ESTree.TSTypeReference,
  index: number,
  substitutions: TypeAliasEnvironment,
): readonly ResolvedType[] {
  return Option.fromNullishOr(reference.typeArguments?.params[index]).pipe(
    Option.map((type): readonly ResolvedType[] => [{ type, substitutions }]),
    Option.getOrElse((): readonly ResolvedType[] => []),
  )
}

function argumentValueTypes(
  reference: ESTree.TSTypeReference,
  index: number,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  resolvingAliases: ReadonlySet<string>,
): readonly ResolvedType[] {
  return Option.fromNullishOr(reference.typeArguments?.params[index]).pipe(
    Option.map((type) => dictionaryValueTypes(type, environment, substitutions, resolvingAliases)),
    Option.getOrElse((): readonly ResolvedType[] => []),
  )
}

function builtInValueTypes(
  reference: ESTree.TSTypeReference,
  name: string,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  resolvingAliases: ReadonlySet<string>,
): Option.Option<readonly ResolvedType[]> {
  if (!isBuiltIn(name, environment)) {
    return Option.none()
  }

  if (TRANSPARENT_WRAPPERS.has(name) || name === 'Pick' || name === 'Omit') {
    return Option.some(
      argumentValueTypes(reference, 0, environment, substitutions, resolvingAliases),
    )
  }

  return name === 'Record'
    ? Option.some(argumentValueType(reference, 1, substitutions))
    : Option.none()
}

function aliasValueTypes(
  name: string,
  reference: ESTree.TSTypeReference,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  resolvingAliases: ReadonlySet<string>,
): readonly ResolvedType[] {
  return Option.fromNullishOr(environment.aliases.get(name)).pipe(
    Option.filter(() => !resolvingAliases.has(name)),
    Option.flatMap((alias) =>
      Option.map(aliasSubstitution(alias, reference, substitutions), (bindings) =>
        dictionaryValueTypes(
          alias.typeAnnotation,
          environment,
          bindings,
          new Set([...resolvingAliases, name]),
        ),
      ),
    ),
    Option.getOrElse((): readonly ResolvedType[] => []),
  )
}

function referenceValueTypes(
  reference: ESTree.TSTypeReference,
  name: string,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  resolvingAliases: ReadonlySet<string>,
): readonly ResolvedType[] {
  const substitution = Option.fromNullishOr(substitutions.get(name))

  if (Option.isSome(substitution)) {
    return isUnappliedReferenceTo(substitution.value, name)
      ? []
      : dictionaryValueTypes(substitution.value, environment, substitutions, resolvingAliases)
  }

  return builtInValueTypes(reference, name, environment, substitutions, resolvingAliases).pipe(
    Option.getOrElse(() =>
      aliasValueTypes(name, reference, environment, substitutions, resolvingAliases),
    ),
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
    return Option.fromNullishOr(unwrapped.typeAnnotation).pipe(
      Option.map((value): readonly ResolvedType[] => [{ type: value, substitutions }]),
      Option.getOrElse((): readonly ResolvedType[] => []),
    )
  }

  if (unwrapped.type !== 'TSTypeReference') {
    return []
  }

  return typeReferenceName(unwrapped).pipe(
    Option.map((name) =>
      referenceValueTypes(unwrapped, name, environment, substitutions, resolvingAliases),
    ),
    Option.getOrElse((): readonly ResolvedType[] => []),
  )
}

export function resolvesToDictionary(
  type: ESTree.TSType,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  resolvingAliases: ReadonlySet<string>,
): boolean {
  return dictionaryValueTypes(type, environment, substitutions, resolvingAliases).length > 0
}
