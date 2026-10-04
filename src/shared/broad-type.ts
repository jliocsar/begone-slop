import type { ESTree } from '@oxlint/plugins'
import { type TypeEnvironment, typeReferenceName } from './type-environment.ts'

export type BroadTypeKind = 'top' | 'object' | 'record'

const DEFINITELY_OBJECT_TYPES = new Set([
  'TSArrayType',
  'TSConstructorType',
  'TSFunctionType',
  'TSMappedType',
  'TSObjectKeyword',
  'TSTupleType',
])

const READONLY_TYPE_NAME = 'Readonly'
const RECORD_TYPE_NAME = 'Record'
const PROPERTY_KEY_TYPE_NAME = 'PropertyKey'
const WHITESPACE = /\s+/gu

function typeArgument(type: ESTree.TSTypeReference, index: number): ESTree.TSType | undefined {
  return type.typeArguments?.params[index]
}

function isBroadRecordKeyType(type: ESTree.TSType): boolean {
  if (
    type.type === 'TSStringKeyword' ||
    type.type === 'TSNumberKeyword' ||
    type.type === 'TSSymbolKeyword'
  ) {
    return true
  }

  if (type.type === 'TSUnionType') {
    return type.types.every(isBroadRecordKeyType)
  }

  return type.type === 'TSTypeReference' && typeReferenceName(type) === PROPERTY_KEY_TYPE_NAME
}

function isBroadRecordArguments(type: ESTree.TSTypeReference): boolean {
  const key = typeArgument(type, 0)
  const value = typeArgument(type, 1)

  return (
    (type.typeArguments?.params.length ?? 0) === 2 &&
    key !== undefined &&
    isBroadRecordKeyType(key) &&
    value !== undefined &&
    isUnknownOrAnyType(value)
  )
}

function isBroadRecordReference(type: ESTree.TSTypeReference): boolean {
  const name = typeReferenceName(type)

  if (name === READONLY_TYPE_NAME) {
    const wrapped = typeArgument(type, 0)

    return wrapped !== undefined && isBroadRecordType(wrapped)
  }

  return name === RECORD_TYPE_NAME && isBroadRecordArguments(type)
}

function isBroadIndexSignature(type: ESTree.TSTypeLiteral): boolean {
  const [member] = type.members

  if (
    member === undefined ||
    type.members.length !== 1 ||
    member.type !== 'TSIndexSignature' ||
    member.parameters.length !== 1
  ) {
    return false
  }

  const [parameter] = member.parameters

  return (
    parameter !== undefined &&
    isBroadRecordKeyType(parameter.typeAnnotation.typeAnnotation) &&
    isUnknownOrAnyType(member.typeAnnotation.typeAnnotation)
  )
}

function isBroadRecordType(type: ESTree.TSType): boolean {
  if (type.type === 'TSTypeReference') {
    return isBroadRecordReference(type)
  }

  return type.type === 'TSTypeLiteral' && isBroadIndexSignature(type)
}

function isUnknownOrAnyType(type: ESTree.TSType): boolean {
  return type.type === 'TSUnknownKeyword' || type.type === 'TSAnyKeyword'
}

export function broadTypeKind(type: ESTree.TSType): BroadTypeKind | undefined {
  if (type.type === 'TSUnknownKeyword' || type.type === 'TSAnyKeyword') {
    return 'top'
  }

  if (type.type === 'TSObjectKeyword') {
    return 'object'
  }

  return isBroadRecordType(type) ? 'record' : undefined
}

function normalizedTypeText(sourceText: string, type: ESTree.TSType): string {
  return sourceText.slice(type.start, type.end).replaceAll(WHITESPACE, '')
}

export function typesHaveSameSyntax(
  sourceText: string,
  left: ESTree.TSType,
  right: ESTree.TSType,
): boolean {
  return normalizedTypeText(sourceText, left) === normalizedTypeText(sourceText, right)
}

function resolvedAlias(
  name: string | undefined,
  environment: TypeEnvironment,
): { readonly aliased: ESTree.TSType; readonly remaining: TypeEnvironment } | undefined {
  const alias = name === undefined ? undefined : environment.aliases.get(name)

  if (
    alias === undefined ||
    (alias.typeParameters !== null && alias.typeParameters !== undefined)
  ) {
    return undefined
  }

  const aliases = new Map([...environment.aliases].filter(([aliasName]) => aliasName !== name))

  return { aliased: alias.typeAnnotation, remaining: { ...environment, aliases } }
}

function interfaceMembers(
  name: string | undefined,
  environment: TypeEnvironment,
): readonly ESTree.TSSignature[] {
  const declarations = name === undefined ? undefined : environment.interfaces.get(name)

  return (declarations ?? []).flatMap((declaration) => declaration.body.body)
}

function isDefinitelyNamedObjectType(
  type: ESTree.TSTypeReference,
  environment: TypeEnvironment,
): boolean {
  const name = typeReferenceName(type)
  const alias = resolvedAlias(name, environment)

  return alias === undefined
    ? interfaceMembers(name, environment).length > 0
    : isDefinitelyObjectType(alias.aliased, alias.remaining)
}

export function isDefinitelyObjectType(type: ESTree.TSType, environment: TypeEnvironment): boolean {
  if (DEFINITELY_OBJECT_TYPES.has(type.type)) {
    return true
  }

  if (type.type === 'TSTypeLiteral') {
    return type.members.length > 0
  }

  if (type.type === 'TSTypeReference') {
    return isDefinitelyNamedObjectType(type, environment)
  }

  if (type.type === 'TSIntersectionType') {
    return type.types.every((member) => isDefinitelyObjectType(member, environment))
  }

  return (
    type.type === 'TSTypeOperator' &&
    type.operator === 'readonly' &&
    isDefinitelyObjectType(type.typeAnnotation, environment)
  )
}

function hasNamedMember(members: readonly ESTree.TSSignature[]): boolean {
  return members.some((member) => member.type !== 'TSIndexSignature')
}

function isDefinitelyNarrowerNamedRecordType(
  name: string | undefined,
  environment: TypeEnvironment,
): boolean {
  const alias = resolvedAlias(name, environment)

  return alias === undefined
    ? hasNamedMember(interfaceMembers(name, environment))
    : isDefinitelyNarrowerRecordType(alias.aliased, alias.remaining)
}

export function isDefinitelyNarrowerRecordType(
  type: ESTree.TSType,
  environment: TypeEnvironment,
): boolean {
  if (type.type === 'TSTypeLiteral') {
    return hasNamedMember(type.members)
  }

  if (type.type !== 'TSTypeReference') {
    return false
  }

  const name = typeReferenceName(type)

  if (name === READONLY_TYPE_NAME) {
    const wrapped = typeArgument(type, 0)

    return wrapped !== undefined && isDefinitelyNarrowerRecordType(wrapped, environment)
  }

  if (name !== RECORD_TYPE_NAME) {
    return isDefinitelyNarrowerNamedRecordType(name, environment)
  }

  const value = typeArgument(type, 1)

  return (
    (type.typeArguments?.params.length ?? 0) === 2 &&
    value !== undefined &&
    !isUnknownOrAnyType(value)
  )
}
