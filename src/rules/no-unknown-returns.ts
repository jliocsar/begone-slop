import type { ESTree } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import {
  type FunctionSignatureNode,
  lexicalTypeParameterNames,
  onFunctionSignatures,
} from '../shared/function-signature.ts'
import { isTypeAliasDeclaration, nearestTypeDeclarations } from '../shared/type-environment.ts'

const PROMISE_TYPE_NAMES = new Set(['Promise', 'PromiseLike'])

const MESSAGE =
  'This function exposes `unknown` to its caller. Parse the value at its boundary and return a named domain type.'

function referencedAliasName(type: ESTree.TSType): string | undefined {
  if (type.type !== 'TSTypeReference' || type.typeName.type !== 'Identifier') {
    return undefined
  }

  const applied = (type.typeArguments?.params.length ?? 0) > 0

  return applied ? undefined : type.typeName.name
}

function resolvesToUnknown(
  scope: ESTree.Node,
  shadowedAliases: ReadonlySet<string>,
  visited: readonly string[],
  type: ESTree.TSType,
): boolean {
  if (type.type === 'TSUnknownKeyword') {
    return true
  }

  if (type.type === 'TSUnionType') {
    return type.types.some((member) => resolvesToUnknown(scope, shadowedAliases, visited, member))
  }

  if (
    type.type === 'TSTypeReference' &&
    type.typeName.type === 'Identifier' &&
    PROMISE_TYPE_NAMES.has(type.typeName.name)
  ) {
    const value = type.typeArguments?.params[0]

    return value !== undefined && resolvesToUnknown(scope, shadowedAliases, visited, value)
  }

  const name = referencedAliasName(type)

  if (name === undefined || visited.includes(name) || shadowedAliases.has(name)) {
    return false
  }

  const alias = nearestTypeDeclarations(scope, name).findLast(isTypeAliasDeclaration)

  if (alias === undefined || (alias.typeParameters ?? null) !== null) {
    return false
  }

  return resolvesToUnknown(scope, shadowedAliases, [...visited, name], alias.typeAnnotation)
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid functions whose return contract resolves to unknown' },
    messages: { unknownReturn: MESSAGE },
  },
  create(context) {
    function reportUnknownReturn(node: FunctionSignatureNode) {
      const type = node.returnType?.typeAnnotation

      if (type === undefined) {
        return
      }

      if (resolvesToUnknown(node, lexicalTypeParameterNames(node), [], type)) {
        context.report({ node: type, messageId: 'unknownReturn' })
      }
    }

    return onFunctionSignatures(reportUnknownReturn)
  },
})
