/**
 * `disableValidation: true` turns a decode into a cast — the schema still
 * describes the shape, but nothing checks the data against it. The gap it hides
 * is in the data or in the schema; keep validation on and fix that instead.
 *
 * Only a literal `true` counts. `disableValidation: false`, a variable, and the
 * shorthand `{ disableValidation }` (whose value is an Identifier) are all left
 * alone.
 *
 * Report-only — the fix is elsewhere, in the data or the schema.
 */

import * as Effect from 'effect/Effect'
import { Diagnostic, type ESTree, Rule, RuleContext } from 'effect-oxlint'

const DISABLE_VALIDATION_KEY = 'disableValidation'

const MESSAGE =
  'Do not use disableValidation: true. Fix the data or schema and keep validation enabled.'

/** `disableValidation`, `#disableValidation` and `'disableValidation'` alike. */
function namesTheOption(key: ESTree.Node): boolean {
  if (key.type === 'Identifier' || key.type === 'PrivateIdentifier') {
    return key.name === DISABLE_VALIDATION_KEY
  }

  return key.type === 'Literal' && key.value === DISABLE_VALIDATION_KEY
}

function disablesValidation(node: ESTree.Node): boolean {
  if (node.type !== 'Property') {
    return false
  }

  return namesTheOption(node.key) && node.value.type === 'Literal' && node.value.value === true
}

export default Rule.define({
  name: 'no-disable-validation',
  meta: Rule.meta({
    type: 'problem',
    description: 'forbid `disableValidation: true`, which decodes without checking the data',
    messages: { noDisableValidation: MESSAGE },
  }),
  create: function* () {
    const context = yield* RuleContext

    return {
      Property: (node: ESTree.Node) =>
        disablesValidation(node)
          ? context.report(Diagnostic.fromId({ node, messageId: 'noDisableValidation' }))
          : Effect.void,
    }
  },
})
