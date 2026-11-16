import type { ESTree, Options } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { staticKeyName, stringLiteralValue } from '../shared/literal.ts'
import { isTestFile } from '../shared/test-file.ts'

type TestCodeOptions = {
  readonly sourceDirectories: readonly string[]
  readonly testDirectories: readonly string[]
}

type ModuleSource = ESTree.Expression | ESTree.StringLiteral | null | undefined

const RELATIVE_PREFIX = '.'
const PATH_SEPARATOR = '/'
const WINDOWS_SEPARATOR = /\\/gu
const DEFAULT_SOURCE_DIRECTORIES = ['src']
const DEFAULT_TEST_DIRECTORIES = ['__tests__', 'test', 'tests']

const TEST_NAME_PATTERNS = [
  /^layer(?:Fake|Mock|Stub|Test)/u,
  /(?:Fake|Mock|Stub|Test)Layer$/u,
  /^(?:Fake|Mock|Stub)[A-Z]/u,
  /[a-z0-9](?:Fake|Mock|Stub)$/u,
  /^(?:create|make)(?:Fake|Mock|Stub|Test)[A-Z]/u,
]

const TEST_FILE_MESSAGE =
  'Tests live in `test/`, not in `{{directory}}/`. Move this file there, with shared helpers beside it.'

const TEST_IMPORT_MESSAGE =
  'Source never depends on test code, and `{{source}}` is test code. Move what this needs into source, or move this module into `test/`.'

const TEST_EXPORT_MESSAGE =
  '`{{name}}` is test code shipped in source. Build it in `test/` from the real layer over fakes instead.'

function configuredOptions(options: Readonly<Options>): TestCodeOptions {
  // SAFETY: oxlint validates configured options against meta.schema before create runs
  const configured = options[0] as Partial<TestCodeOptions> | undefined

  return {
    sourceDirectories: configured?.sourceDirectories ?? DEFAULT_SOURCE_DIRECTORIES,
    testDirectories: configured?.testDirectories ?? DEFAULT_TEST_DIRECTORIES,
  }
}

function relativeSegments(filename: string, cwd: string): readonly string[] {
  const normalised = filename.replace(WINDOWS_SEPARATOR, PATH_SEPARATOR)
  const root = `${cwd.replace(WINDOWS_SEPARATOR, PATH_SEPARATOR)}${PATH_SEPARATOR}`
  const relative = normalised.startsWith(root) ? normalised.slice(root.length) : normalised

  return relative.split(PATH_SEPARATOR)
}

function isTestName(name: string): boolean {
  return TEST_NAME_PATTERNS.some((pattern) => pattern.test(name))
}

function declaredNames(declaration: ESTree.Declaration): readonly ESTree.BindingIdentifier[] {
  if (declaration.type === 'VariableDeclaration') {
    return declaration.declarations.flatMap((declarator) =>
      declarator.id.type === 'Identifier' ? [declarator.id] : [],
    )
  }

  if (
    declaration.type === 'FunctionDeclaration' ||
    declaration.type === 'ClassDeclaration' ||
    declaration.type === 'TSEnumDeclaration'
  ) {
    return declaration.id === null ? [] : [declaration.id]
  }

  return []
}

function exportedName(exported: ESTree.ModuleExportName): string {
  return exported.type === 'Literal' ? exported.value : exported.name
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'keep test files, test imports and test-named exports out of `src/`' },
    messages: {
      testFileInSource: TEST_FILE_MESSAGE,
      testImport: TEST_IMPORT_MESSAGE,
      testExport: TEST_EXPORT_MESSAGE,
    },
    schema: [
      {
        type: 'object',
        properties: {
          sourceDirectories: { type: 'array', items: { type: 'string', minLength: 1 } },
          testDirectories: { type: 'array', items: { type: 'string', minLength: 1 } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = configuredOptions(context.options)
    const segments = relativeSegments(context.filename, context.cwd)
    const sourceIndex = segments.findIndex((segment) => options.sourceDirectories.includes(segment))
    const directory = segments[sourceIndex]

    if (directory === undefined) {
      return {}
    }

    const nestedDirectories = segments.slice(sourceIndex + 1, -1)

    const isTestPath = (path: string) =>
      path.split(PATH_SEPARATOR).some((segment) => options.testDirectories.includes(segment))

    const checkSource = (source: ModuleSource) => {
      const path = source === null || source === undefined ? undefined : stringLiteralValue(source)

      if (
        source !== null &&
        source !== undefined &&
        path?.startsWith(RELATIVE_PREFIX) === true &&
        isTestPath(path)
      ) {
        context.report({ node: source, messageId: 'testImport', data: { source: path } })
      }
    }

    const checkName = (node: ESTree.Node, name: string | undefined) => {
      if (name !== undefined && isTestName(name)) {
        context.report({ node, messageId: 'testExport', data: { name } })
      }
    }

    const checkStaticMember = (node: ESTree.MethodDefinition | ESTree.PropertyDefinition) => {
      if (node.static) {
        checkName(node.key, staticKeyName(node.key, node.computed))
      }
    }

    return {
      Program(node) {
        if (isTestFile(context.filename) || isTestPath(nestedDirectories.join(PATH_SEPARATOR))) {
          context.report({ node, messageId: 'testFileInSource', data: { directory } })
        }
      },
      ImportDeclaration(node) {
        checkSource(node.source)
      },
      ImportExpression(node) {
        checkSource(node.source)
      },
      ExportAllDeclaration(node) {
        checkSource(node.source)
      },
      ExportNamedDeclaration(node) {
        checkSource(node.source)

        for (const identifier of node.declaration === null ? [] : declaredNames(node.declaration)) {
          checkName(identifier, identifier.name)
        }

        for (const specifier of node.specifiers) {
          checkName(specifier, exportedName(specifier.exported))
        }
      },
      MethodDefinition: checkStaticMember,
      PropertyDefinition: checkStaticMember,
    }
  },
})
