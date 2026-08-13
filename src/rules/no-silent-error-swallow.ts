import * as Arr from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import { Diagnostic, type ESTree, Rule, RuleContext } from 'effect-oxlint'

const EFFECT = 'Effect'

const CATCH_METHODS = new Set(['catch', 'catchTag', 'catchTags', 'catchReason', 'catchReasons'])

const VOID_MEMBERS = new Set(['void', 'unit'])

const MESSAGE =
  'Do not silently swallow an Effect error by returning a void effect from a catch handler. Recover meaningfully, transform the error, or let it propagate.'

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
    description: 'forbid catch handlers that swallow the error by returning a void effect',
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
