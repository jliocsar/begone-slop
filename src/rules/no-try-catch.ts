import type { Diagnostic } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import {
  ALLOWLIST_MESSAGES,
  ALLOWLIST_PROPERTIES,
  reportBeyondAllowance,
} from '../shared/allowlist.ts'

const MESSAGE =
  'try/catch erases the error type and catches failures you never meant to handle. Wrap the throwing call in Effect.try or Effect.tryPromise, or model the failure in the error channel.'

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: MESSAGE },
    messages: { noTryCatch: MESSAGE, ...ALLOWLIST_MESSAGES },
    schema: [{ type: 'object', properties: ALLOWLIST_PROPERTIES, additionalProperties: false }],
  },
  create(context) {
    const tryStatements: Diagnostic[] = []

    return {
      TryStatement(node) {
        tryStatements.push({ node, messageId: 'noTryCatch' })
      },
      'Program:exit'(program) {
        reportBeyondAllowance(context, program, tryStatements)
      },
    }
  },
})
