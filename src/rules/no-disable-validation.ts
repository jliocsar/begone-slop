import type { ESTree } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { isNodeOfType } from '../shared/node-type.ts'
import { stringLiteralValue } from '../shared/literal.ts'

const DISABLING_KEYS = new Set(['disableValidation', 'disableChecks'])

const MESSAGE =
  'Disabling validation decodes without checking, so the result carries a type nothing verified. Correct the schema or the data and leave validation on.'

function namesTheOption(key: ESTree.Node): boolean {
  if (isNodeOfType(key, ['Identifier', 'PrivateIdentifier'])) {
    return DISABLING_KEYS.has(key.name)
  }

  const literalKey = stringLiteralValue(key)

  return literalKey !== undefined && DISABLING_KEYS.has(literalKey)
}

function isTrueLiteral(node: ESTree.Node): boolean {
  return node.type === 'Literal' && node.value === true
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'forbid `disableChecks: true` (v3 `disableValidation: true`), which decodes without checking the data',
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
