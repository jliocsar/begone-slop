import type { ESTree } from '@oxlint/plugins'
import { isNodeOfType } from './node-type.ts'

export type FunctionSignatureNode =
  | ESTree.ArrowFunctionExpression
  | ESTree.Function
  | ESTree.TSCallSignatureDeclaration
  | ESTree.TSConstructSignatureDeclaration
  | ESTree.TSConstructorType
  | ESTree.TSFunctionType
  | ESTree.TSMethodSignature

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
    isNodeOfType(node, [
      'ArrowFunctionExpression',
      'FunctionDeclaration',
      'FunctionExpression',
      'TSCallSignatureDeclaration',
      'TSConstructSignatureDeclaration',
    ]) ||
    node.type === 'TSConstructorType' ||
    node.type === 'TSDeclareFunction' ||
    node.type === 'TSEmptyBodyFunctionExpression' ||
    node.type === 'TSFunctionType' ||
    node.type === 'TSMethodSignature'
  )
}

export function parameterAnnotation(
  parameter: ESTree.ParamPattern,
): ESTree.TSTypeAnnotation | undefined {
  if (parameter.type === 'TSParameterProperty') {
    return parameterAnnotation(parameter.parameter)
  }

  if (parameter.type === 'RestElement') {
    return parameter.typeAnnotation ?? parameterAnnotation(parameter.argument)
  }

  if (parameter.type === 'AssignmentPattern') {
    return parameter.typeAnnotation ?? parameter.left.typeAnnotation ?? undefined
  }

  return parameter.typeAnnotation ?? undefined
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

function ownTypeParameters(node: ESTree.Node): ESTree.TSTypeParameterDeclaration | undefined {
  if (
    isFunctionSignature(node) ||
    node.type === 'ClassDeclaration' ||
    node.type === 'ClassExpression' ||
    node.type === 'TSInterfaceDeclaration' ||
    node.type === 'TSTypeAliasDeclaration'
  ) {
    return node.typeParameters ?? undefined
  }

  return undefined
}

function ownTypeParameterNames(node: ESTree.Node): readonly string[] {
  return ownTypeParameters(node)?.params.map((parameter) => parameter.name.name) ?? []
}

function ancestorTypeParameterNames(node: ESTree.Node): readonly string[] {
  const { parent } = node

  if (parent === null) {
    return []
  }

  return [...ownTypeParameterNames(parent), ...ancestorTypeParameterNames(parent)]
}

export function lexicalTypeParameterNames(node: ESTree.Node): ReadonlySet<string> {
  return new Set([...ownTypeParameterNames(node), ...ancestorTypeParameterNames(node)])
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
