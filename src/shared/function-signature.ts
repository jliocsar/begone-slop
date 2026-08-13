import * as Arr from 'effect/Array'
import * as Option from 'effect/Option'
import * as Predicate from 'effect/Predicate'
import type { ESTree, OxlintSourceCode } from 'effect-oxlint'

export type FunctionSignatureNode =
  | ESTree.ArrowFunctionExpression
  | ESTree.Function
  | ESTree.TSCallSignatureDeclaration
  | ESTree.TSConstructSignatureDeclaration
  | ESTree.TSConstructorType
  | ESTree.TSFunctionType
  | ESTree.TSMethodSignature

type TypeParameterOwner = {
  readonly typeParameters?: ESTree.TSTypeParameterDeclaration | null | undefined
}

export type FunctionSignatureVisitor<Handler> = {
  readonly ArrowFunctionExpression: Handler
  readonly FunctionDeclaration: Handler
  readonly FunctionExpression: Handler
  readonly TSCallSignatureDeclaration: Handler
  readonly TSConstructSignatureDeclaration: Handler
  readonly TSConstructorType: Handler
  readonly TSDeclareFunction: Handler
  readonly TSEmptyBodyFunctionExpression: Handler
  readonly TSFunctionType: Handler
  readonly TSMethodSignature: Handler
}

const UNKNOWN_ANNOTATION_SUFFIX = /\s*:\s*unknown\s*$/u

export function isFunctionSignature(node: ESTree.Node): node is FunctionSignatureNode {
  return (
    node.type === 'ArrowFunctionExpression' ||
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression' ||
    node.type === 'TSCallSignatureDeclaration' ||
    node.type === 'TSConstructSignatureDeclaration' ||
    node.type === 'TSConstructorType' ||
    node.type === 'TSDeclareFunction' ||
    node.type === 'TSEmptyBodyFunctionExpression' ||
    node.type === 'TSFunctionType' ||
    node.type === 'TSMethodSignature'
  )
}

export function parameterAnnotation(
  parameter: ESTree.ParamPattern,
): Option.Option<ESTree.TSTypeAnnotation> {
  if (parameter.type === 'TSParameterProperty') {
    return parameterAnnotation(parameter.parameter)
  }

  if (parameter.type === 'RestElement') {
    return Option.orElse(Option.fromNullishOr(parameter.typeAnnotation), () =>
      parameterAnnotation(parameter.argument),
    )
  }

  if (parameter.type === 'AssignmentPattern') {
    return Option.orElse(Option.fromNullishOr(parameter.typeAnnotation), () =>
      Option.fromNullishOr(parameter.left.typeAnnotation),
    )
  }

  return Option.fromNullishOr(parameter.typeAnnotation)
}

export function parameterName(parameter: ESTree.ParamPattern, parameterText: string): string {
  if (parameter.type === 'TSParameterProperty') {
    return parameterName(parameter.parameter, parameterText)
  }

  if (parameter.type === 'AssignmentPattern') {
    return parameterName(parameter.left, parameterText)
  }

  if (parameter.type === 'RestElement') {
    return parameterName(parameter.argument, parameterText)
  }

  return parameter.type === 'Identifier'
    ? parameter.name
    : parameterText.replace(UNKNOWN_ANNOTATION_SUFFIX, '')
}

// oxlint-disable-next-line begone-slop/no-object-parameters -- oxlint's own node union, which ESTree's is not assignable to
function ownsTypeParameters(node: object): node is TypeParameterOwner {
  return Predicate.hasProperty(node, 'typeParameters')
}

// oxlint-disable-next-line begone-slop/no-object-parameters -- oxlint's own node union, which ESTree's is not assignable to
function ownTypeParameterNames(node: object): readonly string[] {
  if (!ownsTypeParameters(node)) {
    return []
  }

  return Arr.map(node.typeParameters?.params ?? [], (parameter) => parameter.name.name)
}

export function lexicalTypeParameterNames(
  sourceCode: OxlintSourceCode,
  node: ESTree.Node,
): ReadonlySet<string> {
  return new Set([
    ...ownTypeParameterNames(node),
    ...Arr.flatMap(sourceCode.getAncestors(node), ownTypeParameterNames),
  ])
}

export function onFunctionSignatures<Handler>(handler: Handler): FunctionSignatureVisitor<Handler> {
  return {
    ArrowFunctionExpression: handler,
    FunctionDeclaration: handler,
    FunctionExpression: handler,
    TSCallSignatureDeclaration: handler,
    TSConstructSignatureDeclaration: handler,
    TSConstructorType: handler,
    TSDeclareFunction: handler,
    TSEmptyBodyFunctionExpression: handler,
    TSFunctionType: handler,
    TSMethodSignature: handler,
  }
}
