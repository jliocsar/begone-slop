import type { Comment } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { isSafetyComment } from '../shared/type-assertion.ts'

const ALLOWED_DIRECTIVE =
  /^[\s*]*(?:\/\s*<reference|@ts-|c8 |eslint-|istanbul |v8 |oxlint-|[#@]__(?:PURE|NO_SIDE_EFFECTS)__|@jsx(?:ImportSource|Frag|Runtime)?\s|@(?:vitest|jest)-environment\s|prettier-ignore|biome-ignore|[#@] sourceMappingURL=)/u

const DECLARATION_FILE_SUFFIX = /\.d\.[cm]?ts$/u

const GENERATED_FILE_MARKER = '.generated.'

const SHEBANG = 'Shebang'

const MESSAGE =
  'A comment drifts out of step with the code beneath it. Rename what reads unclearly, extract what needs explaining, and move anything durable into documentation. Tooling directives and SAFETY justifications are exempt.'

function isExempt(comment: Comment): boolean {
  return (
    comment.type === SHEBANG || isSafetyComment(comment) || ALLOWED_DIRECTIVE.test(comment.value)
  )
}

function isExemptFile(filename: string): boolean {
  return DECLARATION_FILE_SUFFIX.test(filename) || filename.includes(GENERATED_FILE_MARKER)
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'forbid source comments other than compiler, coverage, lint and SAFETY directives',
    },
    messages: { noComments: MESSAGE },
  },
  create(context) {
    if (isExemptFile(context.filename)) {
      return {}
    }

    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (!isExempt(comment)) {
            context.report({ node: comment, messageId: 'noComments' })
          }
        }
      },
    }
  },
})
