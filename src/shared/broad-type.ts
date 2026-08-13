import * as Arr from 'effect/Array'
import * as Option from 'effect/Option'
import type { ESTree } from 'effect-oxlint'
import { typeReferenceName } from './type-environment.ts'

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

function typeArgument(type: ESTree.TSTypeReference, index: number): Option.Option<ESTree.TSType> {
  return Arr.get(type.typeArguments?.params ?? [], index)
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
    return Arr.every(type.types, isBroadRecordKeyType)
  }

  return (
    type.type === 'TSTypeReference' &&
    Option.exists(typeReferenceName(type), (name) => name === PROPERTY_KEY_TYPE_NAME)
  )
}

function isBroadRecordArguments(type: ESTree.TSTypeReference): boolean {
  return (
    (type.typeArguments?.params.length ?? 0) === 2 &&
    Option.exists(typeArgument(type, 0), isBroadRecordKeyType) &&
    Option.exists(typeArgument(type, 1), isUnknownOrAnyType)
  )
}

function isBroadRecordReference(type: ESTree.TSTypeReference): boolean {
  return Option.exists(typeReferenceName(type), (name) =>
    name === READONLY_TYPE_NAME
      ? Option.exists(typeArgument(type, 0), isBroadRecordType)
      : name === RECORD_TYPE_NAME && isBroadRecordArguments(type),
  )
}

function isBroadIndexSignature(type: ESTree.TSTypeLiteral): boolean {
  return Option.exists(
    Arr.head(type.members),
    (member) =>
      type.members.length === 1 &&
      member.type === 'TSIndexSignature' &&
      member.parameters.length === 1 &&
      Option.exists(Arr.head(member.parameters), (parameter) =>
        isBroadRecordKeyType(parameter.typeAnnotation.typeAnnotation),
      ) &&
      isUnknownOrAnyType(member.typeAnnotation.typeAnnotation),
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

export function broadTypeKind(type: ESTree.TSType): Option.Option<BroadTypeKind> {
  if (type.type === 'TSUnknownKeyword' || type.type === 'TSAnyKeyword') {
    return Option.some('top')
  }

  if (type.type === 'TSObjectKeyword') {
    return Option.some('object')
  }

  return isBroadRecordType(type) ? Option.some('record') : Option.none()
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

export function isDefinitelyObjectType(type: ESTree.TSType): boolean {
  if (DEFINITELY_OBJECT_TYPES.has(type.type)) {
    return true
  }

  if (type.type === 'TSTypeLiteral') {
    return type.members.length > 0
  }

  if (type.type === 'TSIntersectionType') {
    return Arr.every(type.types, isDefinitelyObjectType)
  }

  return (
    type.type === 'TSTypeOperator' &&
    type.operator === 'readonly' &&
    isDefinitelyObjectType(type.typeAnnotation)
  )
}

export function isDefinitelyNarrowerRecordType(type: ESTree.TSType): boolean {
  if (type.type === 'TSTypeLiteral') {
    return Arr.some(type.members, (member) => member.type !== 'TSIndexSignature')
  }

  if (type.type !== 'TSTypeReference') {
    return false
  }

  return Option.exists(typeReferenceName(type), (name) =>
    name === READONLY_TYPE_NAME
      ? Option.exists(typeArgument(type, 0), isDefinitelyNarrowerRecordType)
      : name === RECORD_TYPE_NAME &&
        (type.typeArguments?.params.length ?? 0) === 2 &&
        Option.exists(typeArgument(type, 1), (value) => !isUnknownOrAnyType(value)),
  )
}
