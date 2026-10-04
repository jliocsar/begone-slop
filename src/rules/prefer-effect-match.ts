import type { ESTree, SourceCode } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'

const EQUALITY_OPERATORS = new Set(['==', '===', '!=', '!=='])

const MINIMUM_LITERAL_CHECKS = 2

const MESSAGE =
  'A ternary chain over one subject is a match written by hand, with nothing checking the cases are complete. Express it with Match from Effect.'

function isLiteralSide(node: ESTree.Node): boolean {
  return (
    node.type === 'Literal' || (node.type === 'TemplateLiteral' && node.expressions.length === 0)
  )
}

function comparedSide(test: ESTree.Node): ESTree.Node | undefined {
  if (test.type !== 'BinaryExpression' || !EQUALITY_OPERATORS.has(test.operator)) {
    return undefined
  }

  if (isLiteralSide(test.left)) {
    return test.right
  }

  return isLiteralSide(test.right) ? test.left : undefined
}

function chainTests(node: ESTree.ConditionalExpression): readonly ESTree.Node[] {
  const { alternate } = node

  return alternate.type === 'ConditionalExpression'
    ? [node.test, ...chainTests(alternate)]
    : [node.test]
}

function comparesOneSubject(sourceCode: SourceCode, tests: readonly ESTree.Node[]): boolean {
  const subjects: string[] = []

  for (const test of tests) {
    const compared = comparedSide(test)

    if (compared === undefined) {
      return false
    }

    subjects.push(sourceCode.getText(compared))
  }

  return subjects.every((subject) => subject === subjects[0])
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid chained literal ternaries over one subject in favour of Match' },
    messages: { preferEffectMatch: MESSAGE },
  },
  create(context) {
    return {
      ConditionalExpression(node) {
        if (node.parent.type === 'ConditionalExpression') {
          return
        }

        const tests = chainTests(node)

        if (tests.length < MINIMUM_LITERAL_CHECKS) {
          return
        }

        if (comparesOneSubject(context.sourceCode, tests)) {
          context.report({ node, messageId: 'preferEffectMatch' })
        }
      },
    }
  },
})
