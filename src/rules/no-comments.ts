import type { Comment, Diagnostic, ESTree, Options, SourceCode } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import {
  ALLOWLIST_MESSAGES,
  ALLOWLIST_PROPERTIES,
  reportBeyondAllowance,
} from '../shared/allowlist.ts'
import { isSafetyComment } from '../shared/type-assertion.ts'

type CommentOptions = {
  readonly allowWarnings: boolean
  readonly publicApi: readonly string[]
}

const DIRECTIVES = [
  /^\/\s*<reference/u,
  /^@ts-/u,
  /^(?:c8|istanbul|v8) /u,
  /^(?:eslint|oxlint)-/u,
  /^[#@]__(?:PURE|NO_SIDE_EFFECTS)__/u,
  /^@jsx(?:ImportSource|Frag|Runtime)?\s/u,
  /^@(?:vitest|jest)-environment\s/u,
  /^(?:prettier|biome|oxfmt)-ignore/u,
  /^[#@] sourceMappingURL=/u,
  /^@vite-ignore(?:\s|$)/u,
  /^webpack[A-Z]\w*:/u,
  /^nosemgrep(?:[\s:]|$)/u,
  /^SPDX-License-Identifier:/u,
  /^@license(?:\s|$)/u,
]

const COMMENT_DECORATION = /^[\s*!]*/u
const HIDDEN_FROM_PUBLIC_API = /@(?:internal|private)(?:\s|$)/u
const DECLARATION_FILE_SUFFIX = /\.d\.[cm]?ts$/u
const WINDOWS_SEPARATOR = /\\/gu
const GENERATED_FILE_MARKER = '.generated.'
const PATH_SEPARATOR = '/'
const DOC_COMMENT_MARKER = '*'
const WARNING_PREFIX = 'WARNING:'
const SHEBANG = 'Shebang'
const LINE = 'Line'
const BLOCK = 'Block'

const MESSAGE =
  'A comment drifts out of step with the code beneath it. Rename what reads unclearly, extract what needs explaining, and move anything durable into documentation. Tooling directives and SAFETY justifications are exempt.'

function configuredOptions(options: Readonly<Options>): CommentOptions {
  // SAFETY: oxlint validates configured options against meta.schema before create runs
  const configured = options[0] as Partial<CommentOptions> | undefined

  return {
    allowWarnings: configured?.allowWarnings ?? false,
    publicApi: configured?.publicApi ?? [],
  }
}

function isDirective(comment: Comment): boolean {
  const text = comment.value.replace(COMMENT_DECORATION, '')

  return DIRECTIVES.some((directive) => directive.test(text))
}

function isWarning(comment: Comment): boolean {
  const text = comment.value.trim()

  return (
    comment.type === LINE && text.startsWith(WARNING_PREFIX) && text.length > WARNING_PREFIX.length
  )
}

function isExempt(comment: Comment, options: CommentOptions): boolean {
  return (
    comment.type === SHEBANG ||
    isSafetyComment(comment) ||
    isDirective(comment) ||
    (options.allowWarnings && isWarning(comment))
  )
}

function isExemptFile(filename: string): boolean {
  return DECLARATION_FILE_SUFFIX.test(filename) || filename.includes(GENERATED_FILE_MARKER)
}

function isPublicApiFile(filename: string, patterns: readonly string[]): boolean {
  const normalised = filename.replace(WINDOWS_SEPARATOR, PATH_SEPARATOR)

  return patterns.some((pattern) => new RegExp(pattern, 'u').test(normalised))
}

function isPublicClassMember(member: ESTree.Node): boolean {
  if (member.type !== 'MethodDefinition' && member.type !== 'PropertyDefinition') {
    return false
  }

  return (
    member.key.type !== 'PrivateIdentifier' &&
    member.accessibility !== 'private' &&
    member.accessibility !== 'protected'
  )
}

function membersOf(declaration: ESTree.Node | null): readonly ESTree.Node[] {
  if (declaration === null) {
    return []
  }

  if (declaration.type === 'ClassDeclaration' || declaration.type === 'ClassExpression') {
    return declaration.body.body.filter(isPublicClassMember)
  }

  if (declaration.type === 'TSInterfaceDeclaration') {
    return declaration.body.body
  }

  if (declaration.type === 'TSEnumDeclaration') {
    return declaration.body.members
  }

  if (
    declaration.type === 'TSTypeAliasDeclaration' &&
    declaration.typeAnnotation.type === 'TSTypeLiteral'
  ) {
    return declaration.typeAnnotation.members
  }

  return []
}

function localExportNames(program: ESTree.Program): ReadonlySet<string> {
  const names = program.body.flatMap((statement) =>
    statement.type === 'ExportNamedDeclaration' && statement.source === null
      ? statement.specifiers.flatMap((specifier) =>
          specifier.local.type === 'Identifier' ? [specifier.local.name] : [],
        )
      : [],
  )

  return new Set(names)
}

function publicApiNodes(sourceCode: SourceCode, program: ESTree.Program): readonly ESTree.Node[] {
  const listed = localExportNames(program)

  return program.body.flatMap((statement) => {
    if (
      statement.type === 'ExportNamedDeclaration' ||
      statement.type === 'ExportDefaultDeclaration'
    ) {
      return [statement, ...membersOf(statement.declaration)]
    }

    const isListed = sourceCode
      .getDeclaredVariables(statement)
      .some((variable) => listed.has(variable.name))

    return isListed ? [statement, ...membersOf(statement)] : []
  })
}

function docCommentStart(sourceCode: SourceCode, node: ESTree.Node): number | undefined {
  const comment = sourceCode.getCommentsBefore(node).at(-1)

  if (
    comment?.type !== BLOCK ||
    !comment.value.startsWith(DOC_COMMENT_MARKER) ||
    HIDDEN_FROM_PUBLIC_API.test(comment.value)
  ) {
    return undefined
  }

  return comment.start
}

function publicApiDocComments(
  sourceCode: SourceCode,
  program: ESTree.Program,
): ReadonlySet<number> {
  const starts = publicApiNodes(sourceCode, program).flatMap((node) => {
    const start = docCommentStart(sourceCode, node)

    return start === undefined ? [] : [start]
  })

  return new Set(starts)
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'forbid source comments other than compiler, coverage, lint and SAFETY directives',
    },
    messages: { noComments: MESSAGE, ...ALLOWLIST_MESSAGES },
    schema: [
      {
        type: 'object',
        properties: {
          ...ALLOWLIST_PROPERTIES,
          allowWarnings: { type: 'boolean' },
          publicApi: { type: 'array', items: { type: 'string', minLength: 1 } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    if (isExemptFile(context.filename)) {
      return {}
    }

    const options = configuredOptions(context.options)
    const documentsPublicApi = isPublicApiFile(context.filename, options.publicApi)

    return {
      Program(program) {
        const { sourceCode } = context

        const documented = documentsPublicApi
          ? publicApiDocComments(sourceCode, program)
          : new Set<number>()

        const diagnostics = sourceCode
          .getAllComments()
          .filter((comment) => !isExempt(comment, options) && !documented.has(comment.start))
          .map((comment): Diagnostic => ({ node: comment, messageId: 'noComments' }))

        reportBeyondAllowance(context, program, diagnostics)
      },
    }
  },
})
