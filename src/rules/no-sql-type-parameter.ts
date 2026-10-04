import type { ESTree } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'

const SQL_TAG = 'sql'

const MESSAGE =
  'Do not use sql<Type> templates. Use a typed query API or a validated schema instead.'

function isSqlTag(tag: ESTree.Expression): boolean {
  if (tag.type === 'Identifier') {
    return tag.name === SQL_TAG
  }

  return (
    tag.type === 'MemberExpression' &&
    tag.property.type === 'Identifier' &&
    tag.property.name === SQL_TAG
  )
}

function hasTypeArguments(node: ESTree.TaggedTemplateExpression): boolean {
  return node.typeArguments !== undefined && node.typeArguments !== null
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'forbid sql<Type> tagged templates in favour of a typed query API or a schema',
    },
    messages: { noSqlTypeParameter: MESSAGE },
  },
  create(context) {
    return {
      TaggedTemplateExpression(node) {
        if (isSqlTag(node.tag) && hasTypeArguments(node)) {
          context.report({ node, messageId: 'noSqlTypeParameter' })
        }
      },
    }
  },
})
