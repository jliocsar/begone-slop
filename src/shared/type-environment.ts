import * as Arr from 'effect/Array'
import * as Option from 'effect/Option'
import type { ESTree } from 'effect-oxlint'

export type TypeAliasEnvironment = ReadonlyMap<string, ESTree.TSType>

export type TypeEnvironment = {
  readonly aliases: ReadonlyMap<string, ESTree.TSTypeAliasDeclaration>
  readonly interfaces: ReadonlyMap<string, readonly ESTree.TSInterfaceDeclaration[]>
  readonly shadowedBuiltIns: ReadonlySet<string>
}

const BUILT_INS = new Set([
  'Record',
  'Readonly',
  'Partial',
  'Required',
  'Pick',
  'Omit',
  'PropertyKey',
  'NonNullable',
])

export const TRANSPARENT_WRAPPERS = new Set(['Readonly', 'Partial', 'Required', 'NonNullable'])

export const EMPTY_TYPE_ENVIRONMENT: TypeEnvironment = {
  aliases: new Map(),
  interfaces: new Map(),
  shadowedBuiltIns: new Set(),
}

function declaredStatement(
  statement: ESTree.Directive | ESTree.Statement,
): Option.Option<ESTree.Node> {
  if (
    statement.type === 'ExportNamedDeclaration' ||
    statement.type === 'ExportDefaultDeclaration'
  ) {
    return Option.fromNullishOr(statement.declaration)
  }

  return Option.some(statement)
}

function topLevelDeclarations(program: ESTree.Node): readonly ESTree.Node[] {
  if (program.type !== 'Program') {
    return []
  }

  return Arr.getSomes(Arr.map(program.body, declaredStatement))
}

function boundNames(declaration: ESTree.Node): readonly string[] {
  if (declaration.type === 'ImportDeclaration') {
    return Arr.map(declaration.specifiers, (specifier) => specifier.local.name)
  }

  if (
    declaration.type === 'TSTypeAliasDeclaration' ||
    declaration.type === 'TSInterfaceDeclaration' ||
    declaration.type === 'TSEnumDeclaration'
  ) {
    return [declaration.id.name]
  }

  if (declaration.type === 'ClassDeclaration' || declaration.type === 'FunctionDeclaration') {
    return Option.fromNullishOr(declaration.id).pipe(
      Option.map((id): readonly string[] => [id.name]),
      Option.getOrElse((): readonly string[] => []),
    )
  }

  return []
}

function isTypeAliasDeclaration(node: ESTree.Node): node is ESTree.TSTypeAliasDeclaration {
  return node.type === 'TSTypeAliasDeclaration'
}

function isInterfaceDeclaration(node: ESTree.Node): node is ESTree.TSInterfaceDeclaration {
  return node.type === 'TSInterfaceDeclaration'
}

function duplicateNames(names: readonly string[]): readonly string[] {
  return Arr.filter(names, (name, index) => Arr.contains(Arr.take(names, index), name))
}

function aliasesByName(
  aliases: readonly ESTree.TSTypeAliasDeclaration[],
): ReadonlyMap<string, ESTree.TSTypeAliasDeclaration> {
  return new Map(
    Arr.map(Arr.reverse(aliases), (alias): readonly [string, ESTree.TSTypeAliasDeclaration] => [
      alias.id.name,
      alias,
    ]),
  )
}

function interfacesByName(
  declarations: readonly ESTree.TSInterfaceDeclaration[],
): ReadonlyMap<string, readonly ESTree.TSInterfaceDeclaration[]> {
  return new Map(Object.entries(Arr.groupBy(declarations, (declaration) => declaration.id.name)))
}

export function createTypeEnvironment(program: ESTree.Node): TypeEnvironment {
  const declarations = topLevelDeclarations(program)
  const aliases = Arr.filter(declarations, isTypeAliasDeclaration)

  return {
    aliases: aliasesByName(aliases),
    interfaces: interfacesByName(Arr.filter(declarations, isInterfaceDeclaration)),
    shadowedBuiltIns: new Set([
      ...Arr.filter(Arr.flatMap(declarations, boundNames), (name) => BUILT_INS.has(name)),
      ...duplicateNames(Arr.map(aliases, (alias) => alias.id.name)),
    ]),
  }
}

export function typeReferenceName(type: ESTree.TSTypeReference): Option.Option<string> {
  return type.typeName.type === 'Identifier' ? Option.some(type.typeName.name) : Option.none()
}

export function isBuiltIn(name: string, environment: TypeEnvironment): boolean {
  return BUILT_INS.has(name) && !environment.shadowedBuiltIns.has(name)
}

export function unwrapTransparentType(type: ESTree.TSType): ESTree.TSType {
  return type.type === 'TSTypeOperator' && type.operator === 'readonly'
    ? unwrapTransparentType(type.typeAnnotation)
    : type
}

export function isUnappliedReferenceTo(type: ESTree.TSType, name: string): boolean {
  const unwrapped = unwrapTransparentType(type)

  if (unwrapped.type !== 'TSTypeReference') {
    return false
  }

  return (
    Option.contains(typeReferenceName(unwrapped), name) &&
    (unwrapped.typeArguments?.params.length ?? 0) === 0
  )
}

function resolvedSubstitutionArgument(
  type: ESTree.TSType,
  base: TypeAliasEnvironment,
  resolving: ReadonlySet<string>,
): ESTree.TSType {
  const unwrapped = unwrapTransparentType(type)

  if (unwrapped.type !== 'TSTypeReference') {
    return type
  }

  return typeReferenceName(unwrapped).pipe(
    Option.filter((name) => !resolving.has(name)),
    Option.flatMap((name) =>
      Option.map(Option.fromNullishOr(base.get(name)), (substitution) =>
        resolvedSubstitutionArgument(substitution, base, new Set([...resolving, name])),
      ),
    ),
    Option.getOrElse(() => type),
  )
}

export function aliasSubstitution(
  alias: ESTree.TSTypeAliasDeclaration,
  type: ESTree.TSTypeReference,
  base: TypeAliasEnvironment,
): Option.Option<TypeAliasEnvironment> {
  const parameters = alias.typeParameters?.params ?? []
  const typeArguments = type.typeArguments?.params ?? []

  return Arr.reduce(
    parameters,
    Option.some<TypeAliasEnvironment>(base),
    (bindings, parameter, index) =>
      Option.flatMap(bindings, (substitutions) =>
        Option.map(
          Option.fromNullishOr(typeArguments[index] ?? parameter.default),
          (argument): TypeAliasEnvironment =>
            new Map<string, ESTree.TSType>([
              ...substitutions,
              [
                parameter.name.name,
                resolvedSubstitutionArgument(argument, substitutions, new Set()),
              ],
            ]),
        ),
      ),
  )
}
