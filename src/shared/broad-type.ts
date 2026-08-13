/**
 * Reading how WIDE a written type is, purely from its syntax.
 *
 * Three shapes count as broad, because each erases everything about a value
 * while still type-checking: the top types (`unknown`, `any`), `object`, and a
 * record whose keys are a key primitive and whose values are top
 * (`Record<string, unknown>`, `{ [key: string]: any }`, `Readonly<…>` of
 * either).
 *
 * The mirror side is here too — whether an asserted type provably says MORE
 * than one of those — since both halves read the same node shapes.
 */

import * as Arr from 'effect/Array'
import * as Option from 'effect/Option'
import type { ESTree } from 'effect-oxlint'

/** Which of the three broad shapes a type is, if any. */
export type BroadTypeKind = 'top' | 'object' | 'record'

/** Types that can only ever be objects, so asserting one narrows `object`. */
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

/** `Record`, `Readonly`, `PropertyKey` — a qualified name names none of them. */
function typeReferenceName(type: ESTree.TSTypeReference): Option.Option<string> {
  return type.typeName.type === 'Identifier' ? Option.some(type.typeName.name) : Option.none()
}

function typeArgument(type: ESTree.TSTypeReference, index: number): Option.Option<ESTree.TSType> {
  return Arr.get(type.typeArguments?.params ?? [], index)
}

/** Every key a record can have: the three key primitives, or a union of them. */
function isBroadRecordKeyType(type: ESTree.TSType): boolean {
  const unwrapped = unwrapTypeParentheses(type)

  if (
    unwrapped.type === 'TSStringKeyword' ||
    unwrapped.type === 'TSNumberKeyword' ||
    unwrapped.type === 'TSSymbolKeyword'
  ) {
    return true
  }

  if (unwrapped.type === 'TSUnionType') {
    return Arr.every(unwrapped.types, isBroadRecordKeyType)
  }

  return (
    unwrapped.type === 'TSTypeReference' &&
    Option.exists(typeReferenceName(unwrapped), (name) => name === PROPERTY_KEY_TYPE_NAME)
  )
}

/** `Record<BroadKey, unknown>` — both arguments written, both of them wide. */
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

/** `{ [key: string]: unknown }` — the index-signature spelling of the same shape. */
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
  const unwrapped = unwrapTypeParentheses(type)

  if (unwrapped.type === 'TSTypeReference') {
    return isBroadRecordReference(unwrapped)
  }

  return unwrapped.type === 'TSTypeLiteral' && isBroadIndexSignature(unwrapped)
}

/**
 * oxlint 1.77.0 emits no `TSParenthesizedType` — oxc strips redundant parens
 * (measured). Kept for parity with the shapes the type union still allows.
 */
export function unwrapTypeParentheses(type: ESTree.TSType): ESTree.TSType {
  return type.type === 'TSParenthesizedType' ? unwrapTypeParentheses(type.typeAnnotation) : type
}

export function isUnknownOrAnyType(type: ESTree.TSType): boolean {
  const unwrapped = unwrapTypeParentheses(type)

  return unwrapped.type === 'TSUnknownKeyword' || unwrapped.type === 'TSAnyKeyword'
}

export function broadTypeKind(type: ESTree.TSType): Option.Option<BroadTypeKind> {
  const unwrapped = unwrapTypeParentheses(type)

  if (unwrapped.type === 'TSUnknownKeyword' || unwrapped.type === 'TSAnyKeyword') {
    return Option.some('top')
  }

  if (unwrapped.type === 'TSObjectKeyword') {
    return Option.some('object')
  }

  return isBroadRecordType(unwrapped) ? Option.some('record') : Option.none()
}

function normalizedTypeText(sourceText: string, type: ESTree.TSType): string {
  const unwrapped = unwrapTypeParentheses(type)

  return sourceText.slice(unwrapped.start, unwrapped.end).replaceAll(WHITESPACE, '')
}

/** Whitespace carries no meaning in a type, so two spellings of one type match. */
export function typesHaveSameSyntax(
  sourceText: string,
  left: ESTree.TSType,
  right: ESTree.TSType,
): boolean {
  return normalizedTypeText(sourceText, left) === normalizedTypeText(sourceText, right)
}

export function isDefinitelyObjectType(type: ESTree.TSType): boolean {
  const unwrapped = unwrapTypeParentheses(type)

  if (DEFINITELY_OBJECT_TYPES.has(unwrapped.type)) {
    return true
  }

  if (unwrapped.type === 'TSTypeLiteral') {
    return unwrapped.members.length > 0
  }

  if (unwrapped.type === 'TSIntersectionType') {
    return Arr.every(unwrapped.types, isDefinitelyObjectType)
  }

  return (
    unwrapped.type === 'TSTypeOperator' &&
    unwrapped.operator === 'readonly' &&
    isDefinitelyObjectType(unwrapped.typeAnnotation)
  )
}

/** A record is narrowed by naming a key, or by giving the values a real type. */
export function isDefinitelyNarrowerRecordType(type: ESTree.TSType): boolean {
  const unwrapped = unwrapTypeParentheses(type)

  if (unwrapped.type === 'TSTypeLiteral') {
    return Arr.some(unwrapped.members, (member) => member.type !== 'TSIndexSignature')
  }

  if (unwrapped.type !== 'TSTypeReference') {
    return false
  }

  return Option.exists(typeReferenceName(unwrapped), (name) =>
    name === READONLY_TYPE_NAME
      ? Option.exists(typeArgument(unwrapped, 0), isDefinitelyNarrowerRecordType)
      : name === RECORD_TYPE_NAME &&
        (unwrapped.typeArguments?.params.length ?? 0) === 2 &&
        Option.exists(typeArgument(unwrapped, 1), (value) => !isUnknownOrAnyType(value)),
  )
}
