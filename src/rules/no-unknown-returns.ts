import type { ESTree } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import {
  type FunctionSignatureNode,
  lexicalTypeParameterNames,
  onFunctionSignatures,
} from '../shared/function-signature.ts'

type AliasesByName = ReadonlyMap<string, ESTree.TSTypeAliasDeclaration>

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
  aliases: AliasesByName,
  shadowedAliases: ReadonlySet<string>,
  visited: readonly string[],
  type: ESTree.TSType,
): boolean {
  if (type.type === 'TSUnknownKeyword') {
    return true
  }

  if (type.type === 'TSUnionType') {
    return type.types.some((member) => resolvesToUnknown(aliases, shadowedAliases, visited, member))
  }

  if (
    type.type === 'TSTypeReference' &&
    type.typeName.type === 'Identifier' &&
    PROMISE_TYPE_NAMES.has(type.typeName.name)
  ) {
    const value = type.typeArguments?.params[0]

    return value !== undefined && resolvesToUnknown(aliases, shadowedAliases, visited, value)
  }

  const name = referencedAliasName(type)

  if (name === undefined || visited.includes(name) || shadowedAliases.has(name)) {
    return false
  }

  const alias = aliases.get(name)

  if (alias === undefined || (alias.typeParameters ?? null) !== null) {
    return false
  }

  return resolvesToUnknown(aliases, shadowedAliases, [...visited, name], alias.typeAnnotation)
}

function topLevelAlias(
  statement: ESTree.Directive | ESTree.Statement,
): ESTree.TSTypeAliasDeclaration | undefined {
  const declaration =
    statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement

  return declaration !== null && declaration.type === 'TSTypeAliasDeclaration'
    ? declaration
    : undefined
}

function topLevelAliases(program: ESTree.Program): AliasesByName {
  return new Map(
    program.body
      .map(topLevelAlias)
      .filter((alias): alias is ESTree.TSTypeAliasDeclaration => alias !== undefined)
      .map((alias) => [alias.id.name, alias]),
  )
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid functions whose return contract resolves to unknown' },
    messages: { unknownReturn: MESSAGE },
  },
  create(context) {
    let aliases: AliasesByName = new Map()

    function reportUnknownReturn(node: FunctionSignatureNode) {
      const type = node.returnType?.typeAnnotation

      if (type === undefined) {
        return
      }

      if (resolvesToUnknown(aliases, lexicalTypeParameterNames(node), [], type)) {
        context.report({ node: type, messageId: 'unknownReturn' })
      }
    }

    return {
      Program(program) {
        aliases = topLevelAliases(program)
      },
      ...onFunctionSignatures(reportUnknownReturn),
    }
  },
})
