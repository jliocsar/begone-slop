import type { ESTree } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'

type AliasesByName = ReadonlyMap<string, ESTree.TSTypeAliasDeclaration>

const MESSAGE =
  'Type alias `{{alias}}` hides `unknown`. Keep `unknown` explicit at the parsing boundary or on an allowed `cause` field; otherwise use the parsed owner type.'

function referencedAliasName(type: ESTree.TSType): string | undefined {
  if (type.type !== 'TSTypeReference' || type.typeName.type !== 'Identifier') {
    return undefined
  }

  const applied = (type.typeArguments?.params.length ?? 0) > 0

  return applied ? undefined : type.typeName.name
}

function resolvesToUnknown(
  aliases: AliasesByName,
  type: ESTree.TSType,
  visited: readonly string[],
): boolean {
  if (type.type === 'TSUnknownKeyword') {
    return true
  }

  const name = referencedAliasName(type)

  if (name === undefined || visited.includes(name)) {
    return false
  }

  const alias = aliases.get(name)

  if (alias === undefined || (alias.typeParameters ?? null) !== null) {
    return false
  }

  return resolvesToUnknown(aliases, alias.typeAnnotation, [...visited, name])
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

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid type aliases whose resolved type is unknown' },
    messages: { unknownAlias: MESSAGE },
  },
  create(context) {
    return {
      Program(program) {
        const declared = program.body
          .map(topLevelAlias)
          .filter((alias): alias is ESTree.TSTypeAliasDeclaration => alias !== undefined)
        const aliases: AliasesByName = new Map(declared.map((alias) => [alias.id.name, alias]))

        for (const alias of aliases.values()) {
          if (resolvesToUnknown(aliases, alias.typeAnnotation, [alias.id.name])) {
            context.report({
              node: alias.id,
              messageId: 'unknownAlias',
              data: { alias: alias.id.name },
            })
          }
        }
      },
    }
  },
})
