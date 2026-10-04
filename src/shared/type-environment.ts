import type { ESTree } from '@oxlint/plugins'

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
): ESTree.Node | undefined {
  if (
    statement.type === 'ExportNamedDeclaration' ||
    statement.type === 'ExportDefaultDeclaration'
  ) {
    return statement.declaration ?? undefined
  }

  return statement
}

function topLevelDeclarations(program: ESTree.Node): readonly ESTree.Node[] {
  if (program.type !== 'Program') {
    return []
  }

  return program.body
    .map(declaredStatement)
    .filter((declaration): declaration is ESTree.Node => declaration !== undefined)
}

function boundNames(declaration: ESTree.Node): readonly string[] {
  if (declaration.type === 'ImportDeclaration') {
    return declaration.specifiers.map((specifier) => specifier.local.name)
  }

  if (
    declaration.type === 'TSTypeAliasDeclaration' ||
    declaration.type === 'TSInterfaceDeclaration' ||
    declaration.type === 'TSEnumDeclaration'
  ) {
    return [declaration.id.name]
  }

  if (declaration.type === 'ClassDeclaration' || declaration.type === 'FunctionDeclaration') {
    return declaration.id === null ? [] : [declaration.id.name]
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
  return names.filter((name, index) => names.slice(0, index).includes(name))
}

function aliasesByName(
  aliases: readonly ESTree.TSTypeAliasDeclaration[],
): ReadonlyMap<string, ESTree.TSTypeAliasDeclaration> {
  return new Map(
    aliases
      .toReversed()
      .map((alias): readonly [string, ESTree.TSTypeAliasDeclaration] => [alias.id.name, alias]),
  )
}

function interfacesByName(
  declarations: readonly ESTree.TSInterfaceDeclaration[],
): ReadonlyMap<string, readonly ESTree.TSInterfaceDeclaration[]> {
  const grouped = new Map<string, ESTree.TSInterfaceDeclaration[]>()

  for (const declaration of declarations) {
    const name = declaration.id.name
    grouped.set(name, [...(grouped.get(name) ?? []), declaration])
  }

  return grouped
}

export function createTypeEnvironment(program: ESTree.Node): TypeEnvironment {
  const declarations = topLevelDeclarations(program)
  const aliases = declarations.filter(isTypeAliasDeclaration)

  return {
    aliases: aliasesByName(aliases),
    interfaces: interfacesByName(declarations.filter(isInterfaceDeclaration)),
    shadowedBuiltIns: new Set([
      ...declarations.flatMap(boundNames).filter((name) => BUILT_INS.has(name)),
      ...duplicateNames(aliases.map((alias) => alias.id.name)),
    ]),
  }
}

export function typeReferenceName(type: ESTree.TSTypeReference): string | undefined {
  return type.typeName.type === 'Identifier' ? type.typeName.name : undefined
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
    typeReferenceName(unwrapped) === name && (unwrapped.typeArguments?.params.length ?? 0) === 0
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

  const name = typeReferenceName(unwrapped)

  if (name === undefined || resolving.has(name)) {
    return type
  }

  const substitution = base.get(name)

  if (substitution === undefined) {
    return type
  }

  return resolvedSubstitutionArgument(substitution, base, new Set([...resolving, name]))
}

export function aliasSubstitution(
  alias: ESTree.TSTypeAliasDeclaration,
  type: ESTree.TSTypeReference,
  base: TypeAliasEnvironment,
): TypeAliasEnvironment | undefined {
  const parameters = alias.typeParameters?.params ?? []
  const typeArguments = type.typeArguments?.params ?? []
  let substitutions: TypeAliasEnvironment = base

  for (const [index, parameter] of parameters.entries()) {
    const argument = typeArguments[index] ?? parameter.default

    if (argument === undefined || argument === null) {
      return undefined
    }

    substitutions = new Map<string, ESTree.TSType>([
      ...substitutions,
      [parameter.name.name, resolvedSubstitutionArgument(argument, substitutions, new Set())],
    ])
  }

  return substitutions
}
