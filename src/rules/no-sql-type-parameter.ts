import * as Effect from 'effect/Effect'
import * as Predicate from 'effect/Predicate'
import { Diagnostic, type ESTree, Rule, RuleContext } from 'effect-oxlint'

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
  if (node.typeArguments !== undefined && node.typeArguments !== null) {
    return true
  }

  return (
    Predicate.hasProperty(node, 'typeParameters') &&
    node.typeParameters !== undefined &&
    node.typeParameters !== null
  )
}

export default Rule.define({
  name: 'no-sql-type-parameter',
  meta: Rule.meta({
    type: 'problem',
    description: 'forbid sql<Type> tagged templates in favour of a typed query API or a schema',
    messages: { noSqlTypeParameter: MESSAGE },
  }),
  create: function* () {
    const context = yield* RuleContext

    return {
      TaggedTemplateExpression: (node: ESTree.Node) =>
        node.type === 'TaggedTemplateExpression' && isSqlTag(node.tag) && hasTypeArguments(node)
          ? context.report(Diagnostic.fromId({ node, messageId: 'noSqlTypeParameter' }))
          : Effect.void,
    }
  },
})
