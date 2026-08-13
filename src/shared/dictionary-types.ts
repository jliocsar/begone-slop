import * as Arr from 'effect/Array'
import * as Option from 'effect/Option'
import type { ESTree } from 'effect-oxlint'
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

  return Option.fromNullishOr(member.typeAnnotation).pipe(
    Option.exists((annotation) => isNeverType(annotation.typeAnnotation)),
  )
}

function isEffectivelyEmptyTypeLiteral(type: ESTree.TSTypeLiteral): boolean {
  return type.members.length === 0 || Arr.every(type.members, isEffectivelyEmptyMember)
}

function isEffectivelyEmptyInterface(
  declarations: readonly ESTree.TSInterfaceDeclaration[],
): boolean {
  if (declarations.length !== 1) {
    return false
  }

  return Arr.head(declarations).pipe(
    Option.exists(
      (declaration) =>
        declaration.extends.length === 0 &&
        (declaration.body.body.length === 0 ||
          Arr.every(declaration.body.body, isEffectivelyEmptyMember)),
    ),
  )
}

function unsafeKeywordValue(type: ESTree.TSType): Option.Option<UnsafeValue> {
  if (type.type === 'TSUnknownKeyword') {
    return Option.some('unknown')
  }

  if (type.type === 'TSAnyKeyword') {
    return Option.some('any')
  }

  if (type.type === 'TSObjectKeyword') {
    return Option.some('object')
  }

  return type.type === 'TSTypeLiteral' && isEffectivelyEmptyTypeLiteral(type)
    ? Option.some('empty-object')
    : Option.none()
}

function unsafeIntersectionValue(
  members: readonly Option.Option<UnsafeValue>[],
): Option.Option<UnsafeValue> {
  if (Arr.some(members, (member) => Option.contains(member, 'any'))) {
    return Option.some('any')
  }

  return Arr.every(members, Option.isSome) ? Option.flatten(Arr.head(members)) : Option.none()
}

function unsafeAliasValue(
  name: string,
  reference: ESTree.TSTypeReference,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  resolvingAliases: ReadonlySet<string>,
): Option.Option<UnsafeValue> {
  return Option.fromNullishOr(environment.aliases.get(name)).pipe(
    Option.filter(() => !resolvingAliases.has(name)),
    Option.flatMap((alias) =>
      Option.flatMap(aliasSubstitution(alias, reference, substitutions), (bindings) =>
        unsafeDirectValue(
          alias.typeAnnotation,
          environment,
          bindings,
          new Set([...resolvingAliases, name]),
        ),
      ),
    ),
  )
}

function unsafeDeclaredValue(
  name: string,
  reference: ESTree.TSTypeReference,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  resolvingAliases: ReadonlySet<string>,
): Option.Option<UnsafeValue> {
  return Option.match(Option.fromNullishOr(environment.interfaces.get(name)), {
    onSome: (declarations) =>
      isEffectivelyEmptyInterface(declarations) ? Option.some('empty-object') : Option.none(),
    onNone: () => unsafeAliasValue(name, reference, environment, substitutions, resolvingAliases),
  })
}

function unsafeReferenceValue(
  reference: ESTree.TSTypeReference,
  name: string,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  resolvingAliases: ReadonlySet<string>,
): Option.Option<UnsafeValue> {
  if (TRANSPARENT_WRAPPERS.has(name) && isBuiltIn(name, environment)) {
    return Option.flatMap(Option.fromNullishOr(reference.typeArguments?.params[0]), (wrapped) =>
      unsafeDirectValue(wrapped, environment, substitutions, resolvingAliases),
    )
  }

  return Option.match(Option.fromNullishOr(substitutions.get(name)), {
    onSome: (substitution) =>
      isUnappliedReferenceTo(substitution, name)
        ? Option.none()
        : unsafeDirectValue(substitution, environment, substitutions, resolvingAliases),
    onNone: () =>
      unsafeDeclaredValue(name, reference, environment, substitutions, resolvingAliases),
  })
}

function unsafeDirectValue(
  type: ESTree.TSType,
  environment: TypeEnvironment,
  substitutions: TypeAliasEnvironment,
  resolvingAliases: ReadonlySet<string>,
): Option.Option<UnsafeValue> {
  const unwrapped = unwrapTransparentType(type)
  const keyword = unsafeKeywordValue(unwrapped)

  if (Option.isSome(keyword)) {
    return keyword
  }

  if (unwrapped.type === 'TSUnionType') {
    return Arr.some(unwrapped.types, (member) =>
      Option.isSome(unsafeDirectValue(member, environment, substitutions, resolvingAliases)),
    )
      ? Option.some('union')
      : Option.none()
  }

  if (unwrapped.type === 'TSIntersectionType') {
    return unsafeIntersectionValue(
      Arr.map(unwrapped.types, (member) =>
        unsafeDirectValue(member, environment, substitutions, resolvingAliases),
      ),
    )
  }

  if (unwrapped.type !== 'TSTypeReference') {
    return Option.none()
  }

  return Option.flatMap(typeReferenceName(unwrapped), (name) =>
    unsafeReferenceValue(unwrapped, name, environment, substitutions, resolvingAliases),
  )
}

function unsafeDictionary(unsafeValue: UnsafeValue): UnsafeDictionary {
  return { kind: 'unsafe-dictionary', unsafeValue }
}

export function classifyUnsafeDictionaryValue(
  valueType: ESTree.TSType,
  environment: TypeEnvironment,
): Option.Option<UnsafeDictionary> {
  return Option.map(
    unsafeDirectValue(valueType, environment, new Map(), new Set()),
    unsafeDictionary,
  )
}

export function classifyUnsafeDictionary(
  type: ESTree.TSType,
  environment: TypeEnvironment,
): Option.Option<UnsafeDictionary> {
  return Arr.findFirst(dictionaryValueTypes(type, environment, new Map(), new Set()), (value) =>
    unsafeDirectValue(value.type, environment, value.substitutions, new Set()),
  ).pipe(Option.map(unsafeDictionary))
}
