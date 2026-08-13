/**
 * What the dictionary rules know about a file's own types, and the primitives
 * for reading a written type: the top-level aliases and interfaces, and which
 * built-in names the file has taken over.
 *
 * A built-in the file declares or imports (`Record`, `Readonly`, …) loses its
 * built-in meaning for that whole file. Both import spellings bind it — the
 * barrel's named export and the leaf namespace import this repo's style
 * mandates (`import * as Record from 'effect/Record'`) — because a specifier's
 * LOCAL name is what is read (measured: both suppress the rule).
 */

import * as Arr from 'effect/Array'
import * as Option from 'effect/Option'
import type { ESTree } from 'effect-oxlint'

/** Generic arguments bound by an alias application, by parameter name. */
export type TypeAliasEnvironment = ReadonlyMap<string, ESTree.TSType>

export type TypeEnvironment = {
  readonly aliases: ReadonlyMap<string, ESTree.TSTypeAliasDeclaration>
  readonly interfaces: ReadonlyMap<string, readonly ESTree.TSInterfaceDeclaration[]>
  readonly shadowedBuiltIns: ReadonlySet<string>
}

/** The global names this interpreter understands; anything else is opaque. */
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

/** Wrappers that keep their argument's dictionary shape, so they unwrap. */
export const TRANSPARENT_WRAPPERS = new Set(['Readonly', 'Partial', 'Required', 'NonNullable'])

/** What a rule holds before its `Program` handler has run. */
export const EMPTY_TYPE_ENVIRONMENT: TypeEnvironment = {
  aliases: new Map(),
  interfaces: new Map(),
  shadowedBuiltIns: new Set(),
}

/** The declaration a top-level statement carries, `export` stripped. */
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

/** Every name a top-level declaration binds in the module scope. */
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

/** Names written more than once, which no longer resolve to one declaration. */
function duplicateNames(names: readonly string[]): readonly string[] {
  return Arr.filter(names, (name, index) => Arr.contains(Arr.take(names, index), name))
}

/** Reversed so the FIRST declaration of a name wins, as upstream resolves it. */
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

/** Interfaces keep every declaration of a name: two of them means merging. */
function interfacesByName(
  declarations: readonly ESTree.TSInterfaceDeclaration[],
): ReadonlyMap<string, readonly ESTree.TSInterfaceDeclaration[]> {
  return new Map(Object.entries(Arr.groupBy(declarations, (declaration) => declaration.id.name)))
}

/** Read from `Program` in one pass, so a type resolves against the whole file. */
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

/**
 * Parentheses and `readonly` change nothing this interpreter reads. oxlint
 * 1.77.0 emits no `TSParenthesizedType` at all (oxc strips redundant parens,
 * measured), so that branch is inert and kept only for parity with upstream.
 */
export function unwrapTransparentType(type: ESTree.TSType): ESTree.TSType {
  if (type.type === 'TSParenthesizedType') {
    return unwrapTransparentType(type.typeAnnotation)
  }

  if (type.type === 'TSTypeOperator' && type.operator === 'readonly') {
    return unwrapTransparentType(type.typeAnnotation)
  }

  return type
}

/** `Value` bound to a bare `Value`: the parameter never received an argument. */
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

/** An argument that is itself a bound parameter resolves through the bindings. */
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

/**
 * The bindings an alias application introduces. None when a parameter has
 * neither an argument nor a default: the application then says nothing about
 * it. Each parameter resolves against the bindings made before it, as
 * TypeScript scopes defaults.
 */
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
