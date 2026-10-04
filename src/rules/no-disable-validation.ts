import type { ESTree } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'

const DISABLE_VALIDATION_KEY = 'disableValidation'

const MESSAGE =
  'Disabling validation decodes without checking, so the result carries a type nothing verified. Correct the schema or the data and leave validation on.'

function namesTheOption(key: ESTree.Node): boolean {
  if (key.type === 'Identifier' || key.type === 'PrivateIdentifier') {
    return key.name === DISABLE_VALIDATION_KEY
  }

  return key.type === 'Literal' && key.value === DISABLE_VALIDATION_KEY
}

function isTrueLiteral(node: ESTree.Node): boolean {
  return node.type === 'Literal' && node.value === true
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: {
      description: 'forbid `disableValidation: true`, which decodes without checking the data',
    },
    messages: { noDisableValidation: MESSAGE },
  },
  create(context) {
    return {
      Property(node) {
        if (namesTheOption(node.key) && isTrueLiteral(node.value)) {
          context.report({ node, messageId: 'noDisableValidation' })
        }
      },
    }
  },
})
