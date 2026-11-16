import type { ESTree, SourceCode, Variable } from '@oxlint/plugins'
import {
  annotatedBinding,
  findVariable,
  isConstDeclarator,
  isReassigned,
  variableDeclarator,
} from './binding-scope.ts'
import { namesTheGlobal } from './global-reference.ts'
import { stringLiteralValue } from './literal.ts'
import { unwrapTransparentExpression } from './transparent-expression.ts'

export type MethodCall = {
  readonly call: ESTree.CallExpression
  readonly name: string
  readonly receiver: ESTree.Node
}

const ARRAY_RETURNING_METHODS = new Set([
  'concat',
  'filter',
  'flat',
  'flatMap',
  'map',
  'slice',
  'toReversed',
  'toSorted',
  'toSpliced',
  'with',
])

const ARRAY_RETURNING_STATICS = new Map([
  ['Array', new Set(['from', 'of'])],
  ['Object', new Set(['entries', 'keys', 'values'])],
])

const ARRAY_TYPE_NAMES = new Set(['Array', 'ReadonlyArray'])
const READONLY_OPERATOR = 'readonly'

function staticMemberName(member: ESTree.MemberExpression): string | undefined {
  if (member.computed) {
    return stringLiteralValue(member.property)
  }

  return member.property.type === 'Identifier' ? member.property.name : undefined
}

export function methodCall(node: ESTree.Node): MethodCall | undefined {
  const call = unwrapTransparentExpression(node)

  if (call.type !== 'CallExpression') {
    return undefined
  }

  const callee = unwrapTransparentExpression(call.callee)
  const name = callee.type === 'MemberExpression' ? staticMemberName(callee) : undefined

  if (callee.type !== 'MemberExpression' || name === undefined) {
    return undefined
  }

  return { call, name, receiver: callee.object }
}

export function isGlobalStaticCall(
  sourceCode: SourceCode,
  method: MethodCall,
  owner: string,
  name: string,
): boolean {
  return method.name === name && namesTheGlobal(sourceCode, method.receiver, owner)
}

function isArrayReturningStaticCall(sourceCode: SourceCode, method: MethodCall): boolean {
  const owner = method.receiver

  if (owner.type !== 'Identifier') {
    return false
  }

  const names = ARRAY_RETURNING_STATICS.get(owner.name)

  return names?.has(method.name) === true && namesTheGlobal(sourceCode, owner, owner.name)
}

function isArrayAnnotation(annotation: ESTree.TSType): boolean {
  if (annotation.type === 'TSArrayType' || annotation.type === 'TSTupleType') {
    return true
  }

  if (annotation.type === 'TSTypeOperator') {
    return (
      annotation.operator === READONLY_OPERATOR &&
      annotation.typeAnnotation !== null &&
      annotation.typeAnnotation !== undefined &&
      isArrayAnnotation(annotation.typeAnnotation)
    )
  }

  return (
    annotation.type === 'TSTypeReference' &&
    annotation.typeName.type === 'Identifier' &&
    ARRAY_TYPE_NAMES.has(annotation.typeName.name)
  )
}

function isKnownArrayBinding(
  sourceCode: SourceCode,
  identifier: ESTree.Node & { readonly name: string },
  visited: Set<Variable>,
): boolean {
  const variable = findVariable(sourceCode.getScope(identifier), identifier.name)

  if (variable === undefined || visited.has(variable) || isReassigned(variable)) {
    return false
  }

  visited.add(variable)

  const annotated = annotatedBinding(variable)

  if (annotated !== undefined) {
    return isArrayAnnotation(annotated.annotation)
  }

  const declarator = variableDeclarator(variable)
  const initializer = declarator?.init ?? undefined

  if (
    declarator === undefined ||
    initializer === undefined ||
    declarator.id.type !== 'Identifier' ||
    !isConstDeclarator(declarator)
  ) {
    return false
  }

  return isKnownArray(sourceCode, initializer, visited)
}

export function isKnownArray(
  sourceCode: SourceCode,
  node: ESTree.Node,
  visited: Set<Variable>,
): boolean {
  const expression = unwrapTransparentExpression(node)

  if (expression.type === 'ArrayExpression') {
    return true
  }

  if (expression.type === 'Identifier') {
    return isKnownArrayBinding(sourceCode, expression, visited)
  }

  const method = methodCall(expression)

  if (method === undefined) {
    return false
  }

  if (isArrayReturningStaticCall(sourceCode, method)) {
    return true
  }

  return (
    ARRAY_RETURNING_METHODS.has(method.name) && isKnownArray(sourceCode, method.receiver, visited)
  )
}
