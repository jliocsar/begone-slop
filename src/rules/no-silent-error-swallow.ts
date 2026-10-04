import type { ESTree } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'

const EFFECT = 'Effect'

const CATCH_METHODS = new Set([
  'catch',
  'catchCause',
  'catchCauseFilter',
  'catchCauseIf',
  'catchDefect',
  'catchEager',
  'catchFilter',
  'catchIf',
  'catchReason',
  'catchReasons',
  'catchTag',
  'catchTags',
])

const VOID_MEMBERS = new Set(['void', 'unit'])

const MESSAGE =
  'Do not silently swallow an Effect error by returning a void effect from a catch handler. Recover meaningfully, transform the error, or let it propagate.'

function isEffectMember(node: ESTree.Node, names: ReadonlySet<string>): boolean {
  if (node.type !== 'MemberExpression') {
    return false
  }

  return (
    node.object.type === 'Identifier' &&
    node.object.name === EFFECT &&
    node.property.type === 'Identifier' &&
    names.has(node.property.name)
  )
}

function returnsOnlyVoid(node: ESTree.Node): boolean {
  if (node.type !== 'ArrowFunctionExpression' && node.type !== 'FunctionExpression') {
    return false
  }

  const { body } = node

  if (body === null || body === undefined) {
    return false
  }

  if (isEffectMember(body, VOID_MEMBERS)) {
    return true
  }

  if (body.type !== 'BlockStatement') {
    return false
  }

  const [statement] = body.body

  if (body.body.length !== 1 || statement === undefined) {
    return false
  }

  return (
    statement.type === 'ReturnStatement' &&
    statement.argument !== null &&
    statement.argument !== undefined &&
    isEffectMember(statement.argument, VOID_MEMBERS)
  )
}

function silentHandlers(argument: ESTree.Node): readonly ESTree.Node[] {
  const direct: readonly ESTree.Node[] = returnsOnlyVoid(argument) ? [argument] : []

  if (argument.type !== 'ObjectExpression') {
    return direct
  }

  const nested: ESTree.Node[] = []

  for (const property of argument.properties) {
    if (property.type === 'Property' && returnsOnlyVoid(property.value)) {
      nested.push(property.value)
    }
  }

  return [...direct, ...nested]
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'forbid catch handlers that swallow the error by returning a void effect',
    },
    messages: { silentErrorSwallow: MESSAGE },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!isEffectMember(node.callee, CATCH_METHODS)) {
          return
        }

        node.arguments.flatMap(silentHandlers).forEach((handler) => {
          context.report({ node: handler, messageId: 'silentErrorSwallow' })
        })
      },
    }
  },
})
