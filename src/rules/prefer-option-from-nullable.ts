import type { ESTree, SourceCode } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { effectModuleMemberName } from '../shared/effect-module-import.ts'

const OPTION_MODULE = 'Option'
const UNDEFINED = 'undefined'
const PRESENCE_OPERATORS = new Set(['!==', '!='])
const ABSENCE_OPERATORS = new Set(['===', '=='])
const LOOSE_OPERATORS = new Set(['!=', '=='])

const MESSAGE =
  'A ternary that turns {{absent}} into Option.none and anything else into Option.some restates what Option.{{constructor}} already does. Call it directly.'

function isNullLiteral(node: ESTree.Node): boolean {
  return node.type === 'Literal' && node.value === null
}

function isUndefined(node: ESTree.Node): boolean {
  return node.type === 'Identifier' && node.name === UNDEFINED
}

function isNullish(node: ESTree.Node): boolean {
  return isNullLiteral(node) || isUndefined(node)
}

function isSameReference(left: ESTree.Node, right: ESTree.Node): boolean {
  if (left.type === 'Identifier' && right.type === 'Identifier') {
    return left.name === right.name
  }

  if (left.type === 'ThisExpression' && right.type === 'ThisExpression') {
    return true
  }

  if (left.type !== 'MemberExpression' || right.type !== 'MemberExpression') {
    return false
  }

  return (
    !left.computed &&
    !right.computed &&
    left.property.type === 'Identifier' &&
    right.property.type === 'Identifier' &&
    left.property.name === right.property.name &&
    isSameReference(left.object, right.object)
  )
}

function optionMethodArguments(
  sourceCode: SourceCode,
  node: ESTree.Expression,
  method: string,
): readonly ESTree.Argument[] | undefined {
  if (node.type !== 'CallExpression') {
    return undefined
  }

  const callee =
    node.callee.type === 'TSInstantiationExpression' ? node.callee.expression : node.callee

  return effectModuleMemberName(sourceCode, callee, OPTION_MODULE) === method
    ? node.arguments
    : undefined
}

function wrapsSubject(
  sourceCode: SourceCode,
  node: ESTree.Expression,
  subject: ESTree.Node,
): boolean {
  const [wrapped, ...rest] = optionMethodArguments(sourceCode, node, 'some') ?? []

  return wrapped !== undefined && rest.length === 0 && isSameReference(wrapped, subject)
}

function isNoneCall(sourceCode: SourceCode, node: ESTree.Expression): boolean {
  return optionMethodArguments(sourceCode, node, 'none') !== undefined
}

function replacement(operator: string, absentSide: ESTree.Node) {
  if (LOOSE_OPERATORS.has(operator)) {
    return { absent: 'null or undefined', constructor: 'fromNullishOr' }
  }

  return isUndefined(absentSide)
    ? { absent: UNDEFINED, constructor: 'fromUndefinedOr' }
    : { absent: 'null', constructor: 'fromNullOr' }
}

function nullableReplacement(sourceCode: SourceCode, node: ESTree.ConditionalExpression) {
  const { test, consequent, alternate } = node

  if (test.type !== 'BinaryExpression' || (!isNullish(test.left) && !isNullish(test.right))) {
    return undefined
  }

  const [subject, absentSide] = isNullish(test.right)
    ? [test.left, test.right]
    : [test.right, test.left]
  const someWhenPresent =
    PRESENCE_OPERATORS.has(test.operator) &&
    wrapsSubject(sourceCode, consequent, subject) &&
    isNoneCall(sourceCode, alternate)
  const noneWhenAbsent =
    ABSENCE_OPERATORS.has(test.operator) &&
    isNoneCall(sourceCode, consequent) &&
    wrapsSubject(sourceCode, alternate, subject)

  return someWhenPresent || noneWhenAbsent ? replacement(test.operator, absentSide) : undefined
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'require Option.fromNullishOr, fromNullOr or fromUndefinedOr over an Option.some/Option.none ternary',
    },
    messages: { preferOptionFromNullable: MESSAGE },
  },
  create(context) {
    return {
      ConditionalExpression(node) {
        const data = nullableReplacement(context.sourceCode, node)

        if (data !== undefined) {
          context.report({ node, messageId: 'preferOptionFromNullable', data })
        }
      },
    }
  },
})
