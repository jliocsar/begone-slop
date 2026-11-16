import type { ESTree, SourceCode } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { effectModuleMemberName } from '../shared/effect-module-import.ts'
import { unwrapTransparentExpression } from '../shared/transparent-expression.ts'
import { yieldedInto } from '../shared/yielded-binding.ts'

const EFFECT_MODULE = 'Effect'
const PROVIDE_SERVICE = 'provideService'

const MESSAGE =
  '`{{service}}` was just read from the environment, so providing it back changes nothing but hides the requirement. Leave it in the effect requirements and provide its layer once, at the edge.'

function reprovidedService(
  sourceCode: SourceCode,
  node: ESTree.CallExpression,
): string | undefined {
  const service = node.arguments.at(-2)
  const implementation = node.arguments.at(-1)

  if (
    effectModuleMemberName(sourceCode, node.callee, EFFECT_MODULE) !== PROVIDE_SERVICE ||
    service === undefined ||
    implementation === undefined
  ) {
    return undefined
  }

  const yielded = yieldedInto(sourceCode, implementation)
  const serviceText = sourceCode.getText(unwrapTransparentExpression(service))

  return yielded !== undefined && sourceCode.getText(yielded) === serviceText
    ? serviceText
    : undefined
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'forbid providing back a service that was just yielded from the environment',
    },
    messages: { reprovideAmbientService: MESSAGE },
  },
  create(context) {
    return {
      CallExpression(node) {
        const service = reprovidedService(context.sourceCode, node)

        if (service !== undefined) {
          context.report({ node, messageId: 'reprovideAmbientService', data: { service } })
        }
      },
    }
  },
})
