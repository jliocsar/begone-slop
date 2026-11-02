import type { ESTree, SourceCode } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { isNodeOfType } from '../shared/node-type.ts'
import { effectModuleMemberName } from '../shared/effect-module-import.ts'
import { stringLiteralValue } from '../shared/literal.ts'

const EFFECT_MODULE = 'Effect'

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
const IGNORING_MEMBERS = new Set(['ignore', 'ignoreCause'])
const LOG_OPTION = 'log'

const MESSAGE =
  'Do not silently swallow an Effect error by returning a void effect from a catch handler. Recover meaningfully, transform the error, or let it propagate.'

const IGNORE_MESSAGE =
  'Effect.ignore and Effect.ignoreCause drop the failure without a trace. Pass a log option so it is still reported, recover meaningfully, or let it propagate.'

function isLoggingOption(property: ESTree.Node): boolean {
  if (property.type !== 'Property') {
    return false
  }

  const keyName =
    property.key.type === 'Identifier' ? property.key.name : stringLiteralValue(property.key)

  return (
    keyName === LOG_OPTION && !(property.value.type === 'Literal' && property.value.value === false)
  )
}

function passesALogOption(node: ESTree.Node): boolean {
  const call = node.parent

  return (
    call?.type === 'CallExpression' &&
    call.callee === node &&
    call.arguments.some(
      (argument) =>
        argument.type === 'ObjectExpression' && argument.properties.some(isLoggingOption),
    )
  )
}

function ignoresSilently(sourceCode: SourceCode, node: ESTree.Node): boolean {
  const memberName = effectModuleMemberName(sourceCode, node, EFFECT_MODULE)

  return memberName !== undefined && IGNORING_MEMBERS.has(memberName) && !passesALogOption(node)
}

function isEffectMember(
  sourceCode: SourceCode,
  node: ESTree.Node,
  names: ReadonlySet<string>,
): boolean {
  const memberName = effectModuleMemberName(sourceCode, node, EFFECT_MODULE)

  return memberName !== undefined && names.has(memberName)
}

function returnsOnlyVoid(sourceCode: SourceCode, node: ESTree.Node): boolean {
  if (!isNodeOfType(node, ['ArrowFunctionExpression', 'FunctionExpression'])) {
    return false
  }

  const { body } = node

  if (body === null || body === undefined) {
    return false
  }

  if (isEffectMember(sourceCode, body, VOID_MEMBERS)) {
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
    isEffectMember(sourceCode, statement.argument, VOID_MEMBERS)
  )
}

function silentHandlers(sourceCode: SourceCode, argument: ESTree.Node): readonly ESTree.Node[] {
  const direct: readonly ESTree.Node[] = returnsOnlyVoid(sourceCode, argument) ? [argument] : []

  if (argument.type !== 'ObjectExpression') {
    return direct
  }

  const nested: ESTree.Node[] = []

  for (const property of argument.properties) {
    if (property.type === 'Property' && returnsOnlyVoid(sourceCode, property.value)) {
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
    messages: { silentErrorSwallow: MESSAGE, silentIgnore: IGNORE_MESSAGE },
  },
  create(context) {
    return {
      MemberExpression(node) {
        if (ignoresSilently(context.sourceCode, node)) {
          context.report({ node, messageId: 'silentIgnore' })
        }
      },
      CallExpression(node) {
        const { sourceCode } = context

        if (!isEffectMember(sourceCode, node.callee, CATCH_METHODS)) {
          return
        }

        node.arguments
          .flatMap((argument) => silentHandlers(sourceCode, argument))
          .forEach((handler) => {
            context.report({ node: handler, messageId: 'silentErrorSwallow' })
          })
      },
    }
  },
})
