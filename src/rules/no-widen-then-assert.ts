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
import { isTypeAssertion, type TypeAssertion } from '../shared/type-assertion.ts'

type KnownValueEvidence = {
  readonly type: Option.Option<ESTree.TSType>
}

type WidenedBinding = {
  readonly broadKind: BroadTypeKind
  readonly evidence: KnownValueEvidence
  readonly declaredAt: number
  readonly boundary: Option.Option<ESTree.Node>
}

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

const MESSAGE =
  'Binding "{{name}}" discards type evidence and later recreates it with an assertion. Keep the precise type from initialization through use; parse boundary input once.'

function assertionFromExpression(expression: ESTree.Expression): Option.Option<TypeAssertion> {
  return isTypeAssertion(expression) ? Option.some(expression) : Option.none()
}

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
  if (isTypeAssertion(expression)) {
    return Option.isSome(broadTypeKind(expression.typeAnnotation))
      ? Option.none()
      : Option.some({ type: Option.some(expression.typeAnnotation) })
  }

  if (SYNTACTIC_VALUE_EXPRESSIONS.has(expression.type)) {
    return Option.some({ type: Option.none() })
  }

  if (expression.type !== 'Identifier') {
    return Option.none()
  }

  return resolvedVariableForIdentifier(scopes, expression).pipe(
    Option.filter((variable) => !visitedVariables.has(variable)),
    Option.flatMap((variable) =>
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
    onSome: ({ assertion }) => assertion.expression,
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

  const { expression } = node

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
      Diagnostic.fromId({
        node,
        messageId: 'widenThenAssert',
        data: { name: expression.name },
      }),
    ),
  )
}

export default Rule.define({
  name: 'no-widen-then-assert',
  meta: Rule.meta({
    type: 'problem',
    description: 'forbid asserting a widened const binding back to a narrower type',
    messages: { widenThenAssert: MESSAGE },
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
