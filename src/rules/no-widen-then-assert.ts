/**
 * `const raw = parsed as unknown` then `raw as Parsed` throws the type away and
 * hand-writes it back. Nothing was checked in between, so the second spelling is
 * a claim rather than a fact.
 *
 * Only bindings whose original value carries SYNTACTIC evidence count: a
 * literal, an object, an arrow, another assertion, or an annotated binding it
 * was copied from. A call result carries none, so widening one is left alone —
 * this rule never guesses at a type it cannot read. The widening and the
 * assertion must also share a function, with the assertion second; anything
 * else is two authors rather than one round trip.
 *
 * Report-only — the fix is to keep the precise type, which only the author has.
 */

import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import {
  Diagnostic,
  type ESTree,
  type OxlintScope,
  type OxlintSourceCode,
  Rule,
  RuleContext,
  type Variable,
} from 'effect-oxlint'
import {
  annotatedBinding,
  functionBoundary,
  hasSameBoundary,
  isConstDeclarator,
  isReassigned,
  resolvedVariableForIdentifier,
  variableDeclarator,
} from '../shared/binding-scope.ts'
import {
  type BroadTypeKind,
  broadTypeKind,
  isDefinitelyNarrowerRecordType,
  isDefinitelyObjectType,
  typesHaveSameSyntax,
} from '../shared/broad-type.ts'
import {
  isTypeAssertion,
  type TypeAssertion,
  unwrapParenthesizedExpression,
} from '../shared/type-assertion.ts'

/**
 * What the value was before the widening. `type` is none when the evidence is
 * the syntax itself — a literal names no type yet still proves the author knew
 * what they had.
 */
type KnownValueEvidence = {
  readonly type: Option.Option<ESTree.TSType>
}

type WidenedBinding = {
  readonly broadKind: BroadTypeKind
  readonly evidence: KnownValueEvidence
  readonly declaredAt: number
  readonly boundary: Option.Option<ESTree.Node>
}

/** Expressions that are their own evidence: written here, so typed exactly. */
const SYNTACTIC_VALUE_EXPRESSIONS = new Set([
  'ArrayExpression',
  'ArrowFunctionExpression',
  'ClassExpression',
  'FunctionExpression',
  'Literal',
  'NewExpression',
  'ObjectExpression',
  'TemplateLiteral',
])

const NAME_PLACEHOLDER = '{{name}}'

const MESSAGE_TEMPLATE = `Binding "${NAME_PLACEHOLDER}" discards type evidence and later recreates it with an assertion. Keep the precise type from initialization through use; parse boundary input once.`

function assertionFromExpression(expression: ESTree.Expression): Option.Option<TypeAssertion> {
  const unwrapped = unwrapParenthesizedExpression(expression)

  return isTypeAssertion(unwrapped) ? Option.some(unwrapped) : Option.none()
}

/** An annotation is evidence only where it is visible and precise. */
function annotationEvidence(
  identifier: ESTree.Node,
  annotation: ESTree.TSType,
  boundary: Option.Option<ESTree.Node>,
): Option.Option<KnownValueEvidence> {
  return hasSameBoundary(functionBoundary(identifier), boundary) &&
    Option.isNone(broadTypeKind(annotation))
    ? Option.some({ type: Option.some(annotation) })
    : Option.none()
}

function knownValueEvidence(
  expression: ESTree.Expression,
  scopes: readonly OxlintScope[],
  boundary: Option.Option<ESTree.Node>,
  visitedVariables: ReadonlySet<Variable>,
): Option.Option<KnownValueEvidence> {
  const unwrapped = unwrapParenthesizedExpression(expression)

  // An assertion to a precise type IS the evidence; one to a broad type is the
  // widening this rule is chasing, so it proves nothing.
  if (isTypeAssertion(unwrapped)) {
    return Option.isSome(broadTypeKind(unwrapped.typeAnnotation))
      ? Option.none()
      : Option.some({ type: Option.some(unwrapped.typeAnnotation) })
  }

  if (SYNTACTIC_VALUE_EXPRESSIONS.has(unwrapped.type)) {
    return Option.some({ type: Option.none() })
  }

  if (unwrapped.type !== 'Identifier') {
    return Option.none()
  }

  return resolvedVariableForIdentifier(scopes, unwrapped).pipe(
    Option.filter((variable) => !visitedVariables.has(variable)),
    Option.flatMap((variable) =>
      // An annotation on the binding settles it either way — a widened one is
      // not evidence, and the initializer behind it stops mattering.
      Option.match(annotatedBinding(variable), {
        onSome: ({ identifier, annotation }) =>
          annotationEvidence(identifier, annotation, boundary),
        onNone: () => initializerEvidence(variable, scopes, boundary, visitedVariables),
      }),
    ),
  )
}

function initializerEvidence(
  variable: Variable,
  scopes: readonly OxlintScope[],
  boundary: Option.Option<ESTree.Node>,
  visitedVariables: ReadonlySet<Variable>,
): Option.Option<KnownValueEvidence> {
  return variableDeclarator(variable).pipe(
    Option.filter(
      (declarator) =>
        isConstDeclarator(declarator) &&
        !isReassigned(variable) &&
        hasSameBoundary(functionBoundary(declarator), boundary),
    ),
    Option.flatMap((declarator) => Option.fromNullishOr(declarator.init)),
    Option.flatMap((init) =>
      knownValueEvidence(init, scopes, boundary, new Set([...visitedVariables, variable])),
    ),
  )
}

/** The initializer's own widening assertion, when it has one. */
function initializerWidening(
  init: ESTree.Expression,
): Option.Option<{ readonly assertion: TypeAssertion; readonly kind: BroadTypeKind }> {
  return assertionFromExpression(init).pipe(
    Option.flatMap((assertion) =>
      Option.map(broadTypeKind(assertion.typeAnnotation), (kind) => ({ assertion, kind })),
    ),
  )
}

function declaredTypeKind(declarator: ESTree.VariableDeclarator): Option.Option<BroadTypeKind> {
  if (declarator.id.type !== 'Identifier') {
    return Option.none()
  }

  return Option.fromNullishOr(declarator.id.typeAnnotation).pipe(
    Option.flatMap((annotation) => broadTypeKind(annotation.typeAnnotation)),
  )
}

function widenedFromInitializer(
  declarator: ESTree.VariableDeclarator,
  init: ESTree.Expression,
  scopes: readonly OxlintScope[],
  variable: Variable,
): Option.Option<WidenedBinding> {
  const widening = initializerWidening(init)
  const boundary = functionBoundary(declarator)
  const preWidening = Option.match(widening, {
    onSome: ({ assertion }) => unwrapParenthesizedExpression(assertion.expression),
    onNone: () => init,
  })

  return declaredTypeKind(declarator).pipe(
    Option.orElse(() => Option.map(widening, ({ kind }) => kind)),
    Option.flatMap((broadKind) =>
      Option.map(
        knownValueEvidence(preWidening, scopes, boundary, new Set([variable])),
        (evidence) => ({ broadKind, evidence, declaredAt: declarator.end, boundary }),
      ),
    ),
  )
}

/** A `const` whose declaration threw away a type the author demonstrably had. */
function widenedBinding(
  variable: Variable,
  scopes: readonly OxlintScope[],
): Option.Option<WidenedBinding> {
  return variableDeclarator(variable).pipe(
    Option.filter(
      (declarator) =>
        isConstDeclarator(declarator) &&
        declarator.id.type === 'Identifier' &&
        !isReassigned(variable),
    ),
    Option.flatMap((declarator) =>
      Option.fromNullishOr(declarator.init).pipe(
        Option.flatMap((init) => widenedFromInitializer(declarator, init, scopes, variable)),
      ),
    ),
  )
}

/**
 * Whether the assertion actually recovers something. Under a top type anything
 * precise does; under `object` or a broad record only a type that provably says
 * more, or the exact type the evidence already named.
 */
function assertionIsNarrower(
  sourceText: string,
  widened: WidenedBinding,
  assertedType: ESTree.TSType,
): boolean {
  const recreatesEvidence = Option.exists(widened.evidence.type, (type) =>
    typesHaveSameSyntax(sourceText, type, assertedType),
  )

  if (Option.isSome(broadTypeKind(assertedType))) {
    return false
  }

  if (widened.broadKind === 'top' || recreatesEvidence) {
    return true
  }

  return widened.broadKind === 'object'
    ? isDefinitelyObjectType(assertedType)
    : isDefinitelyNarrowerRecordType(assertedType)
}

function widenThenAssertDiagnostic(
  sourceCode: OxlintSourceCode,
  node: ESTree.Node,
): Option.Option<Diagnostic.Diagnostic> {
  if (!isTypeAssertion(node)) {
    return Option.none()
  }

  const expression = unwrapParenthesizedExpression(node.expression)

  if (expression.type !== 'Identifier') {
    return Option.none()
  }

  const { scopes } = sourceCode.scopeManager

  return resolvedVariableForIdentifier(scopes, expression).pipe(
    Option.flatMap((variable) => widenedBinding(variable, scopes)),
    Option.filter(
      (widened) =>
        node.start > widened.declaredAt &&
        hasSameBoundary(functionBoundary(node), widened.boundary) &&
        assertionIsNarrower(sourceCode.text, widened, node.typeAnnotation),
    ),
    Option.map(() =>
      Diagnostic.make({
        node,
        message: MESSAGE_TEMPLATE.replace(NAME_PLACEHOLDER, expression.name),
      }),
    ),
  )
}

export default Rule.define({
  name: 'no-widen-then-assert',
  meta: Rule.meta({
    type: 'problem',
    description: 'forbid asserting a widened const binding back to a narrower type',
  }),
  create: function* () {
    const context = yield* RuleContext

    const report = (node: ESTree.Node) =>
      Option.match(widenThenAssertDiagnostic(context.sourceCode, node), {
        onNone: () => Effect.void,
        onSome: context.report,
      })

    return { TSAsExpression: report, TSTypeAssertion: report }
  },
})
