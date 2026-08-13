import * as Arr from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Predicate from 'effect/Predicate'
import { Diagnostic, type ESTree, Rule, RuleContext } from 'effect-oxlint'

type AliasesByName = ReadonlyMap<string, ESTree.TSTypeAliasDeclaration>

const MESSAGE =
  'Type alias `{{alias}}` hides `unknown`. Keep `unknown` explicit at the parsing boundary or on an allowed `cause` field; otherwise use the parsed owner type.'

function referencedAliasName(type: ESTree.TSType): Option.Option<string> {
  if (type.type !== 'TSTypeReference' || type.typeName.type !== 'Identifier') {
    return Option.none()
  }

  const applied = Option.fromNullishOr(type.typeArguments).pipe(
    Option.exists((typeArguments) => typeArguments.params.length > 0),
  )

  return applied ? Option.none() : Option.some(type.typeName.name)
}

function resolvesToUnknown(
  aliases: AliasesByName,
  type: ESTree.TSType,
  visited: readonly string[],
): boolean {
  if (type.type === 'TSUnknownKeyword') {
    return true
  }

  return referencedAliasName(type).pipe(
    Option.filter((name) => !Arr.contains(visited, name)),
    Option.flatMap((name) =>
      Option.fromNullishOr(aliases.get(name)).pipe(
        Option.filter((alias) => Predicate.isNullish(alias.typeParameters)),
        Option.map((alias) =>
          resolvesToUnknown(aliases, alias.typeAnnotation, Arr.append(visited, name)),
        ),
      ),
    ),
    Option.getOrElse(() => false),
  )
}

function topLevelAlias(
  statement: ESTree.Directive | ESTree.Statement,
): Option.Option<ESTree.TSTypeAliasDeclaration> {
  const declaration =
    statement.type === 'ExportNamedDeclaration' ? statement.declaration : statement

  return declaration !== null && declaration.type === 'TSTypeAliasDeclaration'
    ? Option.some(declaration)
    : Option.none()
}

function unknownAliasDiagnostics(node: ESTree.Node): readonly Diagnostic.Diagnostic[] {
  if (node.type !== 'Program') {
    return []
  }

  const declared = Arr.getSomes(Arr.map(node.body, topLevelAlias))
  const aliases: AliasesByName = new Map(Arr.map(declared, (alias) => [alias.id.name, alias]))

  const hiding = Arr.filter(Arr.fromIterable(aliases.values()), (alias) =>
    resolvesToUnknown(aliases, alias.typeAnnotation, [alias.id.name]),
  )

  return Arr.map(hiding, (alias) =>
    Diagnostic.fromId({
      node: alias.id,
      messageId: 'unknownAlias',
      data: { alias: alias.id.name },
    }),
  )
}

export default Rule.define({
  name: 'no-unknown-type-aliases',
  meta: Rule.meta({
    type: 'problem',
    description: 'forbid type aliases whose resolved type is unknown',
    messages: { unknownAlias: MESSAGE },
  }),
  create: function* () {
    const context = yield* RuleContext

    return {
      Program: (node: ESTree.Node) =>
        Effect.forEach(unknownAliasDiagnostics(node), context.report, { discard: true }),
    }
  },
})
