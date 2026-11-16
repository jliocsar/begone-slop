import type { ESTree, SourceCode } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { effectModuleMemberName } from '../shared/effect-module-import.ts'
import { outermostTransparentWrapper } from '../shared/transparent-expression.ts'
import { yieldedArgument } from '../shared/yielded-binding.ts'

const EFFECT_MODULE = 'Effect'
const LAYER_MODULE = 'Layer'
const CONTEXT_MEMBER = 'context'
const EFFECT_PROVIDERS = new Set(['provide', 'provideContext'])
const LAYER_PROVIDERS = new Set(['provide', 'succeedContext'])

const MESSAGE =
  'Capturing the whole context with `Effect.context` only to provide it back hides what the nested effect needs. `yield*` the services it uses, or leave them in its requirements for the edge to provide.'

function isContextCapture(sourceCode: SourceCode, node: ESTree.VariableDeclarator): boolean {
  const captured = yieldedArgument(node.init)

  return (
    captured?.type === 'CallExpression' &&
    effectModuleMemberName(sourceCode, captured.callee, EFFECT_MODULE) === CONTEXT_MEMBER
  )
}

function isProvidedBack(sourceCode: SourceCode, identifier: ESTree.Node): boolean {
  const argument = outermostTransparentWrapper(identifier)
  const call = argument.parent

  if (
    call?.type !== 'CallExpression' ||
    !call.arguments.some((candidate) => candidate === argument)
  ) {
    return false
  }

  const effectMember = effectModuleMemberName(sourceCode, call.callee, EFFECT_MODULE)
  const layerMember = effectModuleMemberName(sourceCode, call.callee, LAYER_MODULE)

  return (
    (effectMember !== undefined && EFFECT_PROVIDERS.has(effectMember)) ||
    (layerMember !== undefined && LAYER_PROVIDERS.has(layerMember))
  )
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid capturing `Effect.context()` only to provide it back' },
    messages: { preferYieldService: MESSAGE },
  },
  create(context) {
    const { sourceCode } = context

    return {
      VariableDeclarator(node) {
        if (node.id.type !== 'Identifier' || !isContextCapture(sourceCode, node)) {
          return
        }

        const references = sourceCode
          .getDeclaredVariables(node)
          .flatMap((variable) => variable.references)

        if (references.some((reference) => isProvidedBack(sourceCode, reference.identifier))) {
          context.report({ node, messageId: 'preferYieldService' })
        }
      },
    }
  },
})
