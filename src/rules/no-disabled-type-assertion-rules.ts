import type { Options } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'

type DirectiveOptions = {
  readonly additionalRules: readonly string[]
}

const DISABLE_DIRECTIVE = /^\s*(?:eslint|oxlint)-disable(?:-line|-next-line)?(?<rules>\s.*)?$/su
const DESCRIPTION_SEPARATOR = /\s--(?:\s|$)/u
const TYPESCRIPT_ESLINT_PREFIX = /^@?typescript-eslint\//u
const TYPESCRIPT_PREFIX = 'typescript/'
const RULE_SEPARATOR = ','

const TYPE_ASSERTION_RULES = [
  'begone-slop/no-banned-type-assertions',
  'begone-slop/no-chained-type-assertions',
  'begone-slop/no-disabled-type-assertion-rules',
  'begone-slop/no-widen-then-assert',
  'begone-slop/require-safety-comment-for-type-assertion',
  'effecttsgo/unsafe-effect-type-assertion',
  'typescript/consistent-type-assertions',
  'typescript/no-non-null-assertion',
  'typescript/no-unsafe-type-assertion',
]

const DISABLED_RULE_MESSAGE =
  '`{{rule}}` is what keeps unchecked type assertions out, and an inline disable lets one through unseen. Remove the assertion, or move the exception into the lint config where it gets reviewed.'

const BLANKET_DISABLE_MESSAGE =
  'A disable directive that names no rule turns every rule off, the type-assertion ones included. Name the rule it is for.'

function normalizedRuleName(rule: string): string {
  return rule.trim().replace(TYPESCRIPT_ESLINT_PREFIX, TYPESCRIPT_PREFIX)
}

function disabledRules(commentText: string): readonly string[] | undefined {
  const directive = DISABLE_DIRECTIVE.exec(commentText)

  if (directive === null) {
    return undefined
  }

  const [ruleList = ''] = (directive.groups?.['rules'] ?? '').split(DESCRIPTION_SEPARATOR)

  return ruleList
    .split(RULE_SEPARATOR)
    .map(normalizedRuleName)
    .filter((rule) => rule.length > 0)
}

function guardedRules(options: Readonly<Options>): ReadonlySet<string> {
  // SAFETY: oxlint validates configured options against meta.schema before create runs
  const configured = options[0] as Partial<DirectiveOptions> | undefined
  const additionalRules = configured?.additionalRules ?? []

  return new Set([...TYPE_ASSERTION_RULES, ...additionalRules.map(normalizedRuleName)])
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'forbid inline disables of the type-assertion rules, and disables naming no rule',
    },
    messages: {
      disabledTypeAssertionRule: DISABLED_RULE_MESSAGE,
      blanketDisable: BLANKET_DISABLE_MESSAGE,
    },
    schema: [
      {
        type: 'object',
        properties: {
          additionalRules: { type: 'array', items: { type: 'string', minLength: 1 } },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const guarded = guardedRules(context.options)

    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          const rules = disabledRules(comment.value)

          if (rules?.length === 0) {
            context.report({ node: comment, messageId: 'blanketDisable' })
          }

          for (const rule of (rules ?? []).filter((candidate) => guarded.has(candidate))) {
            context.report({
              node: comment,
              messageId: 'disabledTypeAssertionRule',
              data: { rule },
            })
          }
        }
      },
    }
  },
})
