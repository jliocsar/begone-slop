/**
 * Shared signature reading for the two `unknown`-contract rules: the ten
 * function-like node types they both visit, where a parameter's annotation
 * actually sits, and the type parameters in lexical scope at a node.
 *
 * Handlers receive `ESTree.Node`, so the narrowing to a signature node happens
 * here once rather than in each rule.
 */

import * as Arr from 'effect/Array'
import * as Option from 'effect/Option'
import * as Predicate from 'effect/Predicate'
import type { ESTree, OxlintSourceCode } from 'effect-oxlint'

/**
 * Every node that declares parameters and a return contract. `ESTree.Function`
 * covers the four value-level ones (function declaration and expression,
 * `declare function`, and a body-less class method).
 */
export type FunctionSignatureNode =
  | ESTree.ArrowFunctionExpression
  | ESTree.Function
  | ESTree.TSCallSignatureDeclaration
  | ESTree.TSConstructSignatureDeclaration
  | ESTree.TSConstructorType
  | ESTree.TSFunctionType
  | ESTree.TSMethodSignature

/**
 * Many node types carry `typeParameters`, all of them declaring it as a
 * `TSTypeParameterDeclaration` (measured across oxlint's shipped types), so the
 * ancestor walk reads the field structurally instead of listing them.
 */
type TypeParameterOwner = {
  readonly typeParameters?: ESTree.TSTypeParameterDeclaration | null | undefined
}

/** The ten visitor keys that together cover every function-like signature. */
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

/** What a non-identifier pattern's source text ends with when it is `unknown`. */
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

/**
 * The annotation that types a parameter. A parameter property wraps the real
 * parameter; a rest element and a default value each annotate either
 * themselves or the pattern they wrap, depending on where the author wrote it.
 */
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

/**
 * The name to quote back at the author. `parameterText` is the source of the
 * OUTERMOST parameter, so a destructured or otherwise unnamed pattern is quoted
 * as written, minus the annotation being complained about.
 */
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

// oxlint-disable-next-line begone-slop/no-object-parameters -- oxlint node union, per the note on ownTypeParameterNames
function ownsTypeParameters(node: object): node is TypeParameterOwner {
  return Predicate.hasProperty(node, 'typeParameters')
}

/**
 * `object`, not `ESTree.Node`: `getAncestors` is typed with oxlint's own node
 * union, which the ESTree one is not assignable to.
 */
// oxlint-disable-next-line begone-slop/no-object-parameters -- oxlint's own node union, which ESTree's is not assignable to
function ownTypeParameterNames(node: object): readonly string[] {
  if (!ownsTypeParameters(node)) {
    return []
  }

  return Arr.map(node.typeParameters?.params ?? [], (parameter) => parameter.name.name)
}

/**
 * Type parameter names visible at `node`, its own included — a generic `T`
 * shadows any top-level alias of that name. `getAncestors` runs root-inwards
 * and excludes the node itself, hence the separate read.
 */
export function lexicalTypeParameterNames(
  sourceCode: OxlintSourceCode,
  node: ESTree.Node,
): ReadonlySet<string> {
  return new Set([
    ...ownTypeParameterNames(node),
    ...Arr.flatMap(sourceCode.getAncestors(node), ownTypeParameterNames),
  ])
}

/** The ten-key visitor both rules register, given one handler for all of them. */
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
