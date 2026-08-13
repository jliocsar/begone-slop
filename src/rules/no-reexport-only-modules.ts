/**
 * A module whose whole body is `export … from …` owns nothing. It hides the
 * module that does own the code from everyone importing through it, and gives
 * an import cycle somewhere to live. Import from the owner instead.
 *
 * A prologue directive (`"use client"`) is dropped before the check: it
 * configures the module, it is not code the module owns. A local
 * `export { x }` with no source is a real export of local code, so a file
 * containing one is never re-export-only.
 *
 * Framework route files are the exception, and the one this rule is configured
 * for: a router resolving `app/loading.tsx` by path needs the file to exist
 * whatever is inside it. Both halves are options — the directory names that
 * mark a route tree, and the filenames exempt inside one.
 *
 * Report-only — which owning module each importer wants is the caller's call.
 */

import * as Arr from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Schema from 'effect/Schema'
import { Diagnostic, type ESTree, Rule, RuleContext } from 'effect-oxlint'

/** Next.js route files whose whole job is to re-export a component. */
const DEFAULT_ALLOWED_FILENAMES = ['loading.tsx', 'not-found.tsx']

const DEFAULT_ROUTE_DIRECTORY_NAMES = ['app']

const MESSAGE =
  'Do not create re-export-only modules. Import from the owning module directly or add this intentional public entrypoint as an exact lint override.'

/**
 * Both keys default, and the whole object does too — oxlint passes `undefined`
 * for `options[0]` when the rule is configured as a bare `"error"`.
 */
const Options = Schema.Struct({
  allowedFilenames: Schema.Array(Schema.String).pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_ALLOWED_FILENAMES)),
  ),
  routeDirectoryNames: Schema.Array(Schema.String).pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_ROUTE_DIRECTORY_NAMES)),
  ),
}).pipe(Schema.withDecodingDefault(Effect.succeed({})))

type Options = typeof Options.Type

/**
 * `"use client"` and friends. Both `Directive` and `ExpressionStatement` carry
 * the field and share the `ExpressionStatement` type tag, so the string check
 * is what separates them — a plain `'use client'` expression statement mid-file
 * is not a directive and does not get dropped.
 */
function isDirective(statement: ESTree.Node): boolean {
  return statement.type === 'ExpressionStatement' && typeof statement.directive === 'string'
}

/** `export * from './x'`, `export * as ns from './x'`, `export { x } from './x'`. */
function isSourcedReexport(statement: ESTree.Node): boolean {
  if (statement.type === 'ExportAllDeclaration') {
    return true
  }

  return statement.type === 'ExportNamedDeclaration' && statement.source !== null
}

/**
 * A file sitting under a route directory, under one of the exempt names. Both
 * halves must hold: `loading.tsx` outside a route tree is an ordinary module.
 */
function isExemptRouteFile(filename: string, options: Options): boolean {
  const segments = filename.replaceAll('\\', '/').split('/')

  return Arr.last(segments).pipe(
    Option.filter((basename) => Arr.contains(options.allowedFilenames, basename)),
    Option.filter(() =>
      Arr.some(segments, (segment) => Arr.contains(options.routeDirectoryNames, segment)),
    ),
    Option.isSome,
  )
}

/**
 * An empty file re-exports nothing, so it is not an indirection layer — the
 * non-empty check is what keeps `Arr.every`'s vacuous truth out of the report.
 */
function isReexportOnly(node: ESTree.Node): boolean {
  if (node.type !== 'Program') {
    return false
  }

  const statements = Arr.filter(node.body, (statement) => !isDirective(statement))

  return Arr.isReadonlyArrayNonEmpty(statements) && Arr.every(statements, isSourcedReexport)
}

export default Rule.define({
  name: 'no-reexport-only-modules',
  meta: {
    ...Rule.meta({
      type: 'problem',
      description: 'forbid modules whose only statements re-export another module',
      messages: { reexportOnlyModule: MESSAGE },
    }),
    // oxlint rejects options outright unless `schema` is present, before the
    // Effect `Schema` above ever runs.
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
  options: Options,
  create: function* (options) {
    const context = yield* RuleContext

    if (isExemptRouteFile(context.filename, options)) {
      return {}
    }

    return {
      Program: (node: ESTree.Node) =>
        isReexportOnly(node)
          ? context.report(Diagnostic.fromId({ node, messageId: 'reexportOnlyModule' }))
          : Effect.void,
    }
  },
})
