/**
 * A catch handler whose whole body is `Effect.void` or `Effect.unit` deletes the
 * failure: the error never reaches a log, a fallback or the caller's error
 * channel, and the program continues as if nothing went wrong.
 *
 * Only the recovery combinators that take a handler are watched — `catch`,
 * `catchTag`, `catchTags`, `catchReason`, `catchReasons` — and the handler must
 * return void and NOTHING else. A second statement, or any other return value
 * (`Effect.succeed`, `Effect.logError`), is a deliberate recovery.
 *
 * Every report is anchored on the outer call, so a handler map that swallows
 * twice reports twice on the same span.
 *
 * Report-only — recovering meaningfully is a design decision.
 */

import * as Arr from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import { Diagnostic, type ESTree, Rule, RuleContext } from 'effect-oxlint'

const EFFECT = 'Effect'

const CATCH_METHODS = new Set(['catch', 'catchTag', 'catchTags', 'catchReason', 'catchReasons'])

const VOID_MEMBERS = new Set(['void', 'unit'])

const MESSAGE =
  'Do not silently swallow Effect errors with Effect.void or Effect.unit. Recover meaningfully, transform the error, or let it propagate.'

function isEffectMember(node: ESTree.Node, names: ReadonlySet<string>): boolean {
  if (node.type !== 'MemberExpression') {
    return false
  }

  return (
    node.object.type === 'Identifier' &&
    node.object.name === EFFECT &&
    node.property.type === 'Identifier' &&
    names.has(node.property.name)
  )
}

/**
 * A handler whose entire body is `Effect.void`/`Effect.unit`, written either as
 * a concise body or as a block holding one `return`.
 */
function returnsOnlyVoid(node: ESTree.Node): boolean {
  if (node.type !== 'ArrowFunctionExpression' && node.type !== 'FunctionExpression') {
    return false
  }

  const { body } = node

  if (body === null || body === undefined) {
    return false
  }

  if (isEffectMember(body, VOID_MEMBERS)) {
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
    isEffectMember(statement.argument, VOID_MEMBERS)
  )
}

/** The swallowing handlers in one argument: the argument itself, or the values of a handler map. */
function silentHandlers(argument: ESTree.Node): readonly ESTree.Node[] {
  const direct: readonly ESTree.Node[] = returnsOnlyVoid(argument) ? [argument] : []

  if (argument.type !== 'ObjectExpression') {
    return direct
  }

  return Arr.appendAll(
    direct,
    Arr.getSomes(
      Arr.map(argument.properties, (property) =>
        property.type === 'Property' && returnsOnlyVoid(property.value)
          ? Option.some(property.value)
          : Option.none<ESTree.Node>(),
      ),
    ),
  )
}

function silentSwallows(node: ESTree.Node): readonly Diagnostic.Diagnostic[] {
  if (node.type !== 'CallExpression' || !isEffectMember(node.callee, CATCH_METHODS)) {
    return []
  }

  return Arr.map(Arr.flatMap(node.arguments, silentHandlers), () =>
    Diagnostic.fromId({ node, messageId: 'silentErrorSwallow' }),
  )
}

export default Rule.define({
  name: 'no-silent-error-swallow',
  meta: Rule.meta({
    type: 'problem',
    description: 'forbid catch handlers that swallow the error with Effect.void or Effect.unit',
    messages: { silentErrorSwallow: MESSAGE },
  }),
  create: function* () {
    const context = yield* RuleContext

    return {
      CallExpression: (node: ESTree.Node) =>
        Effect.forEach(silentSwallows(node), context.report, { discard: true }),
    }
  },
})
