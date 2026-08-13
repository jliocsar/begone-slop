/**
 * `Array.map(Array.from(xs), f)` makes the inner call's element type the outer
 * call's inference input, so one loose annotation anywhere in the nest degrades
 * everything above it. `pipe` feeds each stage a settled type instead.
 *
 * Only files that took the unaliased `Array` import from effect are in scope —
 * see `shared/effect-array-import.ts`.
 *
 * Report-only — the pipe rewrite depends on which argument is the subject.
 */

import * as Effect from 'effect/Effect'
import * as Predicate from 'effect/Predicate'
import * as Ref from 'effect/Ref'
import { Diagnostic, type ESTree, Rule, RuleContext } from 'effect-oxlint'
import { EFFECT_ARRAY_BINDING, importsEffectArrayUnaliased } from '../shared/effect-array-import.ts'

/**
 * The shape the containment walk needs, which no ESTree type describes: it
 * descends through arbitrary keys of values it has not narrowed yet.
 */
// oxlint-disable-next-line begone-slop/no-unsafe-dictionary-type -- an untyped AST node is exactly what this walk receives
type NodeLike = { readonly [key: string]: unknown; readonly type: string }

/** Every node points back at its parent, so a walk that follows it never ends. */
const PARENT_KEY = 'parent'

const MESSAGE = 'Do not nest Effect Array method calls. Use pipe to preserve inference.'

// oxlint-disable-next-line begone-slop/no-unknown-parameters -- walks arbitrary AST fields; oxlint's node types do not model them
function isNodeLike(value: unknown): value is NodeLike {
  return (
    typeof value === 'object' &&
    value !== null &&
    Predicate.hasProperty(value, 'type') &&
    Predicate.isString(value.type)
  )
}

// oxlint-disable-next-line begone-slop/no-unknown-parameters -- walks arbitrary AST fields; oxlint's node types do not model them
function isIdentifierNamed(value: unknown, name: string): boolean {
  return (
    isNodeLike(value) &&
    value.type === 'Identifier' &&
    Predicate.isString(value.name) &&
    value.name === name
  )
}

/** `Array.<anything>(…)`, the method name being the caller's business. */
// oxlint-disable-next-line begone-slop/no-unknown-parameters -- walks arbitrary AST fields; oxlint's node types do not model them
function isEffectArrayMethodCall(value: unknown): boolean {
  if (!isNodeLike(value) || value.type !== 'CallExpression') {
    return false
  }

  const { callee } = value

  return (
    isNodeLike(callee) &&
    callee.type === 'MemberExpression' &&
    isIdentifierNamed(callee.object, EFFECT_ARRAY_BINDING) &&
    isNodeLike(callee.property) &&
    callee.property.type === 'Identifier'
  )
}

/** `Array.isArray` narrows `unknown` to `any[]`, putting an `any` back into every
 * element read. */
// oxlint-disable-next-line begone-slop/no-unknown-parameters -- walks arbitrary AST fields; oxlint's node types do not model them
function isUnknownArray(value: unknown): value is readonly unknown[] {
  return Array.isArray(value)
}

// oxlint-disable-next-line begone-slop/no-unknown-parameters -- walks arbitrary AST fields; oxlint's node types do not model them
function containsEffectArrayMethodCall(value: unknown, seen: WeakSet<object>): boolean {
  if (typeof value !== 'object' || value === null || seen.has(value)) {
    return false
  }

  seen.add(value)

  if (isEffectArrayMethodCall(value)) {
    return true
  }

  if (isUnknownArray(value)) {
    return value.some((item) => containsEffectArrayMethodCall(item, seen))
  }

  return Object.entries(value).some(
    ([key, child]: [string, unknown]) =>
      key !== PARENT_KEY && containsEffectArrayMethodCall(child, seen),
  )
}

function nestsAnotherArrayCall(node: ESTree.Node): boolean {
  if (node.type !== 'CallExpression' || !isEffectArrayMethodCall(node)) {
    return false
  }

  return node.arguments.some((argument) =>
    containsEffectArrayMethodCall(argument, new WeakSet<object>()),
  )
}

export default Rule.define({
  name: 'no-nested-effect-array-methods',
  meta: Rule.meta({
    type: 'problem',
    description: 'forbid nesting one effect Array method call inside another',
    messages: { nestedEffectArrayMethods: MESSAGE },
  }),
  create: function* () {
    const context = yield* RuleContext
    const shadowsTheGlobal = yield* Ref.make(false)

    return {
      Program: (node: ESTree.Node) => Ref.set(shadowsTheGlobal, importsEffectArrayUnaliased(node)),
      CallExpression: (node: ESTree.Node) =>
        Effect.flatMap(Ref.get(shadowsTheGlobal), (shadowed) =>
          shadowed && nestsAnotherArrayCall(node)
            ? context.report(Diagnostic.fromId({ node, messageId: 'nestedEffectArrayMethods' }))
            : Effect.void,
        ),
    }
  },
})
