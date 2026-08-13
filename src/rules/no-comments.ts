import * as Arr from 'effect/Array'
import * as Effect from 'effect/Effect'
import { Diagnostic, type OxlintComment, Rule, RuleContext } from 'effect-oxlint'

const ALLOWED_DIRECTIVE = /^(?:\/\s*<reference|@ts-|c8 |eslint-|istanbul |oxlint-|SAFETY:)/u

const DECLARATION_FILE_SUFFIX = '.d.ts'

const GENERATED_FILE_MARKER = '.generated.'

const SHEBANG = 'Shebang'

const MESSAGE =
  'Remove this comment. Keep the code self-explanatory; lint and compiler directives remain available for explicit exceptions.'

function isExempt(comment: OxlintComment): boolean {
  return comment.type === SHEBANG || ALLOWED_DIRECTIVE.test(comment.value.trim())
}

function isExemptFile(filename: string): boolean {
  return filename.endsWith(DECLARATION_FILE_SUFFIX) || filename.includes(GENERATED_FILE_MARKER)
}

export default Rule.define({
  name: 'no-comments',
  meta: Rule.meta({
    type: 'problem',
    description: 'forbid source comments other than compiler, coverage, lint and SAFETY directives',
    messages: { noComments: MESSAGE },
  }),
  create: function* () {
    const context = yield* RuleContext

    if (isExemptFile(context.filename)) {
      return {}
    }

    return {
      Program: () =>
        Effect.forEach(
          Arr.map(
            Arr.filter(context.sourceCode.getAllComments(), (comment) => !isExempt(comment)),
            (comment) => Diagnostic.fromId({ node: comment, messageId: 'noComments' }),
          ),
          context.report,
          { discard: true },
        ),
    }
  },
})
