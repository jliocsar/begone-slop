/**
 * A prose comment is documentation that no tool checks and no reader trusts
 * once the code beside it moves. Name the binding, split the function, or write
 * it down in the docs — the ones that survive are the ones a tool reads.
 *
 * Exempt: the shebang, and the directive prefixes below, which change what a
 * compiler, coverage tool or linter does. `SAFETY:` is exempt for the same
 * reason — `require-safety-comment-for-type-assertion` DEMANDS one on every
 * non-const assertion, so without the carve-out the two rules cannot both be
 * satisfied. Anchored at the start: a `SAFETY:` buried mid-sentence is prose.
 *
 * JSDoc is not exempt. Declaration files and `.generated.` files are, whole.
 *
 * Report-only — deleting a comment is the author's call, and some of them say
 * something worth moving rather than dropping.
 */

import * as Arr from 'effect/Array'
import * as Effect from 'effect/Effect'
import { Diagnostic, type OxlintComment, Rule, RuleContext } from 'effect-oxlint'

/**
 * `//` is already stripped from `comment.value`, which is why a triple-slash
 * reference reaches this as `/ <reference`.
 */
const ALLOWED_DIRECTIVE = /^(?:\/\s*<reference|@ts-|c8 |eslint-|istanbul |oxlint-|SAFETY:)/u

const DECLARATION_FILE_SUFFIX = '.d.ts'

const GENERATED_FILE_MARKER = '.generated.'

const SHEBANG = 'Shebang'

const MESSAGE =
  'Remove this comment. Keep the code self-explanatory; lint and compiler directives remain available for explicit exceptions.'

function isExempt(comment: OxlintComment): boolean {
  return comment.type === SHEBANG || ALLOWED_DIRECTIVE.test(comment.value.trim())
}

/** Neither the file's own contents nor its comments are the author's writing. */
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
