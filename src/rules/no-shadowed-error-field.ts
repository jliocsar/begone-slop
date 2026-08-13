/**
 * Error fields are assigned onto the instance, so a `name` or `stack` field
 * replaces what identifies the error as an error — `Cause.pretty`, the stack
 * header and OTLP's `exception.type`/`exception.stacktrace` all read them.
 *
 * `message` and `cause` stay legal: both were measured, and Effect gives `cause`
 * Error's own meaning.
 *
 * Report-only — the replacement is the domain word for what the field holds.
 */

import * as Arr from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import { Diagnostic, type ESTree, Rule, RuleContext } from 'effect-oxlint'

/**
 * Only the two whose shadow destroys information. See the note above for why
 * `message` and `cause` are not here.
 */
const SHADOWED_PROPERTIES = new Set(['name', 'stack'])

/**
 * The error-class factories, by the name they are called under. All are curried
 * — `Schema.TaggedErrorClass<Self>()('Tag', { fields })` — so the fields sit on
 * the OUTER call and the factory name on the inner callee. `Schema.ErrorClass`
 * is the untagged sibling and takes its fields in the same position.
 */
const ERROR_CLASS_FACTORIES = new Set(['TaggedErrorClass', 'ErrorClass'])

const MESSAGE =
  "A `{{field}}` field shadows `Error.prototype.{{field}}`, so this error stops identifying itself — `Cause.pretty`, the stack header and OTLP's exception.type/exception.stacktrace all read that property. Name the field for what it holds instead (`userName`, `agentName`, `commandStack`)."

/**
 * `TaggedErrorClass`, `Schema.TaggedErrorClass`, `S.TaggedErrorClass` — the
 * import style is the caller's business, the last name is what identifies it.
 */
function calleeName(node: ESTree.Expression): Option.Option<string> {
  if (node.type === 'Identifier') {
    return Option.some(node.name)
  }

  if (node.type === 'MemberExpression' && !node.computed && node.property.type === 'Identifier') {
    return Option.some(node.property.name)
  }

  return Option.none()
}

/**
 * The fields object of `<factory>()(...)`, or none if this is some other call.
 * Both arguments are read positionally: the tag, then the fields.
 */
function fieldsObject(node: ESTree.CallExpression): Option.Option<ESTree.ObjectExpression> {
  const curried = node.callee

  if (curried.type !== 'CallExpression') {
    return Option.none()
  }

  return calleeName(curried.callee).pipe(
    Option.filter((name) => ERROR_CLASS_FACTORIES.has(name)),
    Option.flatMap(() =>
      Arr.findFirst(node.arguments, (argument) => argument.type === 'ObjectExpression'),
    ),
  )
}

function shadowedOnly(name: string): Option.Option<string> {
  return SHADOWED_PROPERTIES.has(name) ? Option.some(name) : Option.none()
}

function shadowedFieldName(property: ESTree.ObjectPropertyKind): Option.Option<string> {
  if (property.type !== 'Property') {
    return Option.none()
  }

  if (!property.computed && property.key.type === 'Identifier') {
    return shadowedOnly(property.key.name)
  }

  if (property.key.type === 'Literal' && typeof property.key.value === 'string') {
    return shadowedOnly(property.key.value)
  }

  return Option.none()
}

function shadowedFields(node: ESTree.Node): readonly Diagnostic.Diagnostic[] {
  if (node.type !== 'CallExpression') {
    return []
  }

  return fieldsObject(node).pipe(
    Option.map((fields) =>
      Arr.getSomes(
        fields.properties.map((property) =>
          shadowedFieldName(property).pipe(
            Option.map((field) =>
              Diagnostic.fromId({
                node: property,
                messageId: 'shadowedErrorField',
                data: { field },
              }),
            ),
          ),
        ),
      ),
    ),
    Option.getOrElse((): readonly Diagnostic.Diagnostic[] => []),
  )
}

export default Rule.define({
  name: 'no-shadowed-error-field',
  meta: Rule.meta({
    type: 'problem',
    description: "forbid error schema fields that shadow Error's own properties",
    messages: { shadowedErrorField: MESSAGE },
  }),
  create: function* () {
    const context = yield* RuleContext

    return {
      CallExpression: (node: ESTree.Node) =>
        Effect.forEach(shadowedFields(node), context.report, { discard: true }),
    }
  },
})
