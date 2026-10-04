import type { ESTree, SourceCode } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { isNodeOfType } from '../shared/node-type.ts'
import { effectModuleMemberName } from '../shared/effect-module-import.ts'

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

const MESSAGE =
  'Do not silently swallow an Effect error by returning a void effect from a catch handler. Recover meaningfully, transform the error, or let it propagate.'

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
    messages: { silentErrorSwallow: MESSAGE },
  },
  create(context) {
    return {
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
