import type { ESTree } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'

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
  node: ESTree.Expression,
  method: string,
): readonly ESTree.Argument[] | undefined {
  if (node.type !== 'CallExpression') {
    return undefined
  }

  const callee =
    node.callee.type === 'TSInstantiationExpression' ? node.callee.expression : node.callee

  if (
    callee.type !== 'MemberExpression' ||
    callee.object.type !== 'Identifier' ||
    callee.object.name !== OPTION_MODULE ||
    callee.property.type !== 'Identifier' ||
    callee.property.name !== method
  ) {
    return undefined
  }

  return node.arguments
}

function wrapsSubject(node: ESTree.Expression, subject: ESTree.Node): boolean {
  const [wrapped, ...rest] = optionMethodArguments(node, 'some') ?? []

  return wrapped !== undefined && rest.length === 0 && isSameReference(wrapped, subject)
}

function isNoneCall(node: ESTree.Expression): boolean {
  return optionMethodArguments(node, 'none') !== undefined
}

function replacement(operator: string, absentSide: ESTree.Node) {
  if (LOOSE_OPERATORS.has(operator)) {
    return { absent: 'null or undefined', constructor: 'fromNullishOr' }
  }

  return isUndefined(absentSide)
    ? { absent: UNDEFINED, constructor: 'fromUndefinedOr' }
    : { absent: 'null', constructor: 'fromNullOr' }
}

function nullableReplacement(node: ESTree.ConditionalExpression) {
  const { test, consequent, alternate } = node

  if (test.type !== 'BinaryExpression' || (!isNullish(test.left) && !isNullish(test.right))) {
    return undefined
  }

  const [subject, absentSide] = isNullish(test.right)
    ? [test.left, test.right]
    : [test.right, test.left]
  const someWhenPresent =
    PRESENCE_OPERATORS.has(test.operator) &&
    wrapsSubject(consequent, subject) &&
    isNoneCall(alternate)
  const noneWhenAbsent =
    ABSENCE_OPERATORS.has(test.operator) &&
    isNoneCall(consequent) &&
    wrapsSubject(alternate, subject)

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
        const data = nullableReplacement(node)

        if (data !== undefined) {
          context.report({ node, messageId: 'preferOptionFromNullable', data })
        }
      },
    }
  },
})
