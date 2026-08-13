import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import { Diagnostic, type ESTree, Rule, RuleContext, SourceCode } from 'effect-oxlint'

const EQUALITY_OPERATORS = new Set(['==', '===', '!=', '!=='])

const MINIMUM_LITERAL_CHECKS = 2

const MESSAGE = 'Use Match from effect instead of a chained literal ternary.'

function isLiteralSide(node: ESTree.Node): boolean {
  return (
    node.type === 'Literal' || (node.type === 'TemplateLiteral' && node.expressions.length === 0)
  )
}

function comparedSide(test: ESTree.Node): Option.Option<ESTree.Node> {
  if (test.type !== 'BinaryExpression' || !EQUALITY_OPERATORS.has(test.operator)) {
    return Option.none()
  }

  if (isLiteralSide(test.left)) {
    return Option.some(test.right)
  }

  return isLiteralSide(test.right) ? Option.some(test.left) : Option.none()
}

function chainTests(node: ESTree.ConditionalExpression): readonly ESTree.Node[] {
  const { alternate } = node

  return alternate.type === 'ConditionalExpression'
    ? [node.test, ...chainTests(alternate)]
    : [node.test]
}

function comparedText(test: ESTree.Node): Effect.Effect<Option.Option<string>, never, RuleContext> {
  return Option.match(comparedSide(test), {
    onNone: () => Effect.succeed(Option.none<string>()),
    onSome: (compared) => SourceCode.getNodeText(compared).pipe(Effect.map(Option.some)),
  })
}

function comparesOneSubject(subjects: readonly Option.Option<string>[]): boolean {
  return Option.match(Option.all(subjects), {
    onNone: () => false,
    onSome: (texts) => texts.every((text) => text === texts[0]),
  })
}

export default Rule.define({
  name: 'prefer-effect-match',
  meta: Rule.meta({
    type: 'problem',
    description: 'forbid chained literal ternaries over one subject in favour of Match',
    messages: { preferEffectMatch: MESSAGE },
  }),
  create: function* () {
    const context = yield* RuleContext

    return {
      ConditionalExpression: (node: ESTree.Node) => {
        if (node.type !== 'ConditionalExpression' || node.parent.type === 'ConditionalExpression') {
          return Effect.void
        }

        const tests = chainTests(node)

        if (tests.length < MINIMUM_LITERAL_CHECKS) {
          return Effect.void
        }

        return Effect.forEach(tests, comparedText).pipe(
          Effect.flatMap((subjects) =>
            comparesOneSubject(subjects)
              ? context.report(Diagnostic.fromId({ node, messageId: 'preferEffectMatch' }))
              : Effect.void,
          ),
        )
      },
    }
  },
})
