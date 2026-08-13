import * as Arr from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Predicate from 'effect/Predicate'
import * as Schema from 'effect/Schema'
import { Diagnostic, type ESTree, Rule, RuleContext } from 'effect-oxlint'

const DEFAULT_ALLOWED_FILENAMES = ['loading.tsx', 'not-found.tsx']

const DEFAULT_ROUTE_DIRECTORY_NAMES = ['app']

const MESSAGE =
  'Do not create re-export-only modules. Import from the owning module directly or add this intentional public entrypoint as an exact lint override.'

const Options = Schema.Struct({
  allowedFilenames: Schema.Array(Schema.String).pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_ALLOWED_FILENAMES)),
  ),
  routeDirectoryNames: Schema.Array(Schema.String).pipe(
    Schema.withDecodingDefault(Effect.succeed(DEFAULT_ROUTE_DIRECTORY_NAMES)),
  ),
}).pipe(Schema.withDecodingDefault(Effect.succeed({})))

type Options = typeof Options.Type

function isDirective(statement: ESTree.Node): boolean {
  return statement.type === 'ExpressionStatement' && Predicate.isString(statement.directive)
}

function isSourcedReexport(statement: ESTree.Node): boolean {
  if (statement.type === 'ExportAllDeclaration') {
    return true
  }

  return statement.type === 'ExportNamedDeclaration' && statement.source !== null
}

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
