import type { ESTree, SourceCode } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { effectModuleMemberName } from '../shared/effect-module-import.ts'
import { enclosingFunction } from '../shared/enclosing-function.ts'
import { outermostTransparentWrapper } from '../shared/transparent-expression.ts'

const EFFECT_MODULE = 'Effect'
const PREDICATE_MODULE = 'Predicate'
const IS_TAGGED = 'isTagged'
const BROAD_CATCHES = new Set(['catch', 'catchAll', 'catchCause', 'catchIf'])

const MESSAGE =
  '`Predicate.isTagged` takes `unknown`, so a misspelt tag still compiles, and inside a broad catch it rebuilds by hand what `Effect.catchTag` checks. Use `Effect.catchTag` or `catchTags`, `Effect.catchReason` or `catchReasons` for a nested `reason`, or `Union.guards.X` for one variant.'

function isBroadCatchArgument(sourceCode: SourceCode, node: ESTree.Node): boolean {
  const argument = outermostTransparentWrapper(node)
  const call = argument.parent

  if (
    call?.type !== 'CallExpression' ||
    !call.arguments.some((candidate) => candidate === argument)
  ) {
    return false
  }

  const operator = effectModuleMemberName(sourceCode, call.callee, EFFECT_MODULE)

  return operator !== undefined && BROAD_CATCHES.has(operator)
}

function insideBroadCatch(sourceCode: SourceCode, node: ESTree.Node): boolean {
  const owner = enclosingFunction(node)

  if (owner === undefined) {
    return false
  }

  return isBroadCatchArgument(sourceCode, owner) || insideBroadCatch(sourceCode, owner)
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid `Predicate.isTagged` checks inside a broad Effect catch' },
    messages: { preferTaggedErrorHandling: MESSAGE },
  },
  create(context) {
    const { sourceCode } = context

    return {
      CallExpression(node) {
        if (effectModuleMemberName(sourceCode, node.callee, PREDICATE_MODULE) !== IS_TAGGED) {
          return
        }

        if (isBroadCatchArgument(sourceCode, node) || insideBroadCatch(sourceCode, node)) {
          context.report({ node, messageId: 'preferTaggedErrorHandling' })
        }
      },
    }
  },
})
