import type { ESTree } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { staticKeyName, stringLiteralValue } from '../shared/literal.ts'
import { unwrapTransparentExpression } from '../shared/transparent-expression.ts'

const TAG = '_tag'

const LITERAL_MESSAGE =
  'A hand-written `_tag` is a claim nothing checks: it drifts from the type it names, and a misspelt tag still compiles. Build the value with its tagged constructor, such as a `Schema.TaggedError` or `Schema.TaggedClass`, a tagged struct `make`, or `Data.TaggedClass`.'

const FIELD_MESSAGE =
  'Declare a tagged class with `Schema.TaggedClass`, `Schema.TaggedError` or `Data.TaggedClass` instead of writing its `_tag` field by hand.'

function isLiteralTag(value: ESTree.Node): boolean {
  const expression = unwrapTransparentExpression(value)

  if (expression.type === 'TemplateLiteral') {
    return expression.expressions.length === 0
  }

  return stringLiteralValue(expression) !== undefined
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid hand-written `_tag` literals and `_tag` class fields' },
    messages: { manualTaggedLiteral: LITERAL_MESSAGE, manualTagField: FIELD_MESSAGE },
  },
  create(context) {
    return {
      Property(node) {
        if (
          node.parent.type === 'ObjectExpression' &&
          staticKeyName(node.key, node.computed) === TAG &&
          isLiteralTag(node.value)
        ) {
          context.report({ node, messageId: 'manualTaggedLiteral' })
        }
      },
      PropertyDefinition(node) {
        if (staticKeyName(node.key, node.computed) === TAG) {
          context.report({ node, messageId: 'manualTagField' })
        }
      },
    }
  },
})
