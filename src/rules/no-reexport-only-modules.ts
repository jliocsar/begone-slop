import type { ESTree, Options } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'

type ReexportOptions = {
  readonly allowedFilenames: readonly string[]
  readonly routeDirectoryNames: readonly string[]
}

const DEFAULT_ALLOWED_FILENAMES = ['loading.tsx', 'not-found.tsx']

const DEFAULT_ROUTE_DIRECTORY_NAMES = ['app']

const MESSAGE =
  'A module that only re-exports adds a hop without adding meaning, and hides where a symbol actually lives. Import from the owning module, or override this rule for a deliberate public entrypoint.'

function configuredOptions(options: Readonly<Options>): ReexportOptions {
  // SAFETY: oxlint validates configured options against meta.schema before create runs
  const configured = options[0] as Partial<ReexportOptions> | undefined

  return {
    allowedFilenames: configured?.allowedFilenames ?? DEFAULT_ALLOWED_FILENAMES,
    routeDirectoryNames: configured?.routeDirectoryNames ?? DEFAULT_ROUTE_DIRECTORY_NAMES,
  }
}

function isDirective(statement: ESTree.Directive | ESTree.Statement): boolean {
  return statement.type === 'ExpressionStatement' && (statement.directive ?? null) !== null
}

function isSourcedReexport(statement: ESTree.Directive | ESTree.Statement): boolean {
  if (statement.type === 'ExportAllDeclaration') {
    return true
  }

  return statement.type === 'ExportNamedDeclaration' && statement.source !== null
}

function isImportWithBindings(statement: ESTree.Directive | ESTree.Statement): boolean {
  return statement.type === 'ImportDeclaration' && statement.specifiers.length > 0
}

function importedNames(
  statements: readonly (ESTree.Directive | ESTree.Statement)[],
): ReadonlySet<string> {
  return new Set(
    statements.flatMap((statement) =>
      statement.type === 'ImportDeclaration'
        ? statement.specifiers.map((specifier) => specifier.local.name)
        : [],
    ),
  )
}

function isImportedReexport(
  statement: ESTree.Directive | ESTree.Statement,
  imported: ReadonlySet<string>,
): boolean {
  if (statement.type === 'ExportDefaultDeclaration') {
    return statement.declaration.type === 'Identifier' && imported.has(statement.declaration.name)
  }

  if (statement.type !== 'ExportNamedDeclaration' || statement.declaration !== null) {
    return false
  }

  return (
    statement.specifiers.length > 0 &&
    statement.specifiers.every(
      (specifier) => specifier.local.type === 'Identifier' && imported.has(specifier.local.name),
    )
  )
}

function isExemptRouteFile(filename: string, options: ReexportOptions): boolean {
  const segments = filename.replaceAll('\\', '/').split('/')
  const basename = segments.at(-1)

  return (
    basename !== undefined &&
    options.allowedFilenames.includes(basename) &&
    segments.some((segment) => options.routeDirectoryNames.includes(segment))
  )
}

function isReexportOnly(program: ESTree.Program): boolean {
  const statements = program.body.filter((statement) => !isDirective(statement))
  const imported = importedNames(statements)
  const exports = statements.filter((statement) => !isImportWithBindings(statement))

  return (
    exports.length > 0 &&
    exports.every(
      (statement) => isSourcedReexport(statement) || isImportedReexport(statement, imported),
    )
  )
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid modules whose only statements re-export another module' },
    messages: { reexportOnlyModule: MESSAGE },
    schema: [
      {
        type: 'object',
        properties: {
          allowedFilenames: { type: 'array', items: { type: 'string' } },
          routeDirectoryNames: { type: 'array', items: { type: 'string' } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    if (isExemptRouteFile(context.filename, configuredOptions(context.options))) {
      return {}
    }

    return {
      Program(program) {
        if (isReexportOnly(program)) {
          context.report({ node: program, messageId: 'reexportOnlyModule' })
        }
      },
    }
  },
})
