import type { ESTree } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import {
  type FunctionSignatureNode,
  lexicalTypeParameterNames,
  onFunctionSignatures,
  parameterAnnotation,
} from '../shared/function-signature.ts'

type AliasesByName = ReadonlyMap<string, ESTree.TSType>

const OBJECT_ANNOTATION_SUFFIX = /\s*:\s*object\s*$/u

const MESSAGE =
  'Parameter `{{parameter}}` uses the broad `object` type. Accept a named owner type; parse external input at its boundary before calling this function.'

function boundTypeName(node: ESTree.Node): string | undefined {
  if (node.type === 'TSMappedType') {
    return node.key.name
  }

  if (node.type === 'TSInferType') {
    return node.typeParameter.name.name
  }

  return undefined
}

function enclosingBoundTypeNames(node: ESTree.Node): readonly string[] {
  const { parent } = node

  if (parent === null) {
    return []
  }

  const bound = boundTypeName(parent)
  const enclosing = enclosingBoundTypeNames(parent)

  return bound === undefined ? enclosing : [bound, ...enclosing]
}

function shadowedAliasNames(node: ESTree.Node): ReadonlySet<string> {
  return new Set([...lexicalTypeParameterNames(node), ...enclosingBoundTypeNames(node)])
}

function referencedAliasName(type: ESTree.TSType): string | undefined {
  if (type.type !== 'TSTypeReference' || type.typeName.type !== 'Identifier') {
    return undefined
  }

  const applied = (type.typeArguments?.params.length ?? 0) > 0

  return applied ? undefined : type.typeName.name
}

function resolvesToObject(
  aliases: AliasesByName,
  shadowedAliases: ReadonlySet<string>,
  visited: readonly string[],
  type: ESTree.TSType,
): boolean {
  if (type.type === 'TSObjectKeyword') {
    return true
  }

  if (type.type === 'TSUnionType') {
    return type.types.some((member) => resolvesToObject(aliases, shadowedAliases, visited, member))
  }

  const name = referencedAliasName(type)

  if (name === undefined || visited.includes(name) || shadowedAliases.has(name)) {
    return false
  }

  const alias = aliases.get(name)

  if (alias === undefined) {
    return false
  }

  return resolvesToObject(aliases, shadowedAliases, [...visited, name], alias)
}

function parameterLabel(parameter: ESTree.ParamPattern, parameterText: string): string {
  return parameter.type === 'Identifier'
    ? parameter.name
    : parameterText.replace(OBJECT_ANNOTATION_SUFFIX, '')
}

function topLevelAlias(
  statement: ESTree.Directive | ESTree.Statement,
): ESTree.TSTypeAliasDeclaration | undefined {
  const declaration =
    statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement

  return declaration !== null &&
    declaration.type === 'TSTypeAliasDeclaration' &&
    (declaration.typeParameters ?? null) === null
    ? declaration
    : undefined
}

function topLevelAliases(program: ESTree.Program): AliasesByName {
  return new Map(
    program.body
      .map(topLevelAlias)
      .filter((alias): alias is ESTree.TSTypeAliasDeclaration => alias !== undefined)
      .map((alias) => [alias.id.name, alias.typeAnnotation]),
  )
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid parameters typed object, aliases to it included' },
    messages: { objectParameter: MESSAGE },
  },
  create(context) {
    let aliases: AliasesByName = new Map()

    function reportObjectParameters(node: FunctionSignatureNode) {
      const shadowedAliases = shadowedAliasNames(node)

      for (const parameter of node.params) {
        const type = parameterAnnotation(parameter)?.typeAnnotation

        if (type !== undefined && resolvesToObject(aliases, shadowedAliases, [], type)) {
          context.report({
            node: type,
            messageId: 'objectParameter',
            data: { parameter: parameterLabel(parameter, context.sourceCode.getText(parameter)) },
          })
        }
      }
    }

    return {
      Program(program) {
        aliases = topLevelAliases(program)
      },
      ...onFunctionSignatures(reportObjectParameters),
    }
  },
})
