import type { Diagnostic } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import {
  ALLOWLIST_MESSAGES,
  ALLOWLIST_PROPERTIES,
  reportBeyondAllowance,
} from '../shared/allowlist.ts'

const MESSAGE =
  'A switch falls through silently and never reports a missing case. Use Match from Effect, which can be made exhaustive.'

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: MESSAGE },
    messages: { noSwitch: MESSAGE, ...ALLOWLIST_MESSAGES },
    schema: [{ type: 'object', properties: ALLOWLIST_PROPERTIES, additionalProperties: false }],
  },
  create(context) {
    const switches: Diagnostic[] = []

    return {
      SwitchStatement(node) {
        switches.push({ node, messageId: 'noSwitch' })
      },
      'Program:exit'(program) {
        reportBeyondAllowance(context, program, switches)
      },
    }
  },
})
