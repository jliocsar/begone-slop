import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Ref from 'effect/Ref'
import {
  Diagnostic,
  type ESTree,
  type OxlintSourceCode,
  Rule,
  RuleContext,
  type Variable,
} from 'effect-oxlint'
import { resolvedVariableForIdentifier, variableDeclarator } from '../shared/binding-scope.ts'
import {
  enclosingFunction,
  type FunctionOwner,
  functionName,
  sourceKeyName,
} from '../shared/enclosing-function.ts'
import { hasKnownEvidence, isEmptyObjectExpression } from '../shared/known-evidence.ts'
import { isTypeAssertion } from '../shared/type-assertion.ts'
import {
  createTypeEnvironment,
  EMPTY_TYPE_ENVIRONMENT,
  type TypeEnvironment,
} from '../shared/type-environment.ts'
import { classifyWideningTarget, type WideningTarget } from '../shared/widening-targets.ts'

type Diagnose = (
  sourceCode: OxlintSourceCode,
  node: ESTree.Node,
  environment: TypeEnvironment,
) => Option.Option<Diagnostic.Diagnostic>

const MESSAGE =
  'The explicit {{target}} type on {{subject}} discards known type evidence. Keep inference, validate with `satisfies`, or use a named owner contract.'

const ASSERTION_SUBJECT = 'assertion'

const ACCUMULATOR_TARGET_KINDS = new Set(['generic container', 'open dictionary'])

function annotationTarget(
  annotation: ESTree.TSTypeAnnotation | null | undefined,
  environment: TypeEnvironment,
): Option.Option<WideningTarget> {
  return Option.flatMap(Option.fromNullishOr(annotation), (annotated) =>
    classifyWideningTarget(annotated.typeAnnotation, environment),
  )
}

function returnTypeTarget(
  owner: Option.Option<FunctionOwner>,
  environment: TypeEnvironment,
): Option.Option<WideningTarget> {
  return Option.flatMap(owner, (fn) => annotationTarget(fn.returnType, environment))
}

function wideningDiagnostic(
  sourceCode: OxlintSourceCode,
  expression: ESTree.Expression,
  target: Option.Option<WideningTarget>,
  subject: string,
): Option.Option<Diagnostic.Diagnostic> {
  return target.pipe(
    Option.filter(
      (destination) =>
        !(ACCUMULATOR_TARGET_KINDS.has(destination.kind) && isEmptyObjectExpression(expression)),
    ),
    Option.filter(() =>
      hasKnownEvidence(sourceCode.scopeManager.scopes, expression, new Set<Variable>()),
    ),
    Option.map((destination) =>
      Diagnostic.fromId({
        node: expression,
        messageId: 'knownValueWidening',
        data: { subject, target: destination.kind },
      }),
    ),
  )
}

function bindingDiagnostic(
  sourceCode: OxlintSourceCode,
  node: ESTree.Node,
  environment: TypeEnvironment,
): Option.Option<Diagnostic.Diagnostic> {
  if (node.type !== 'VariableDeclarator' || node.id.type !== 'Identifier') {
    return Option.none()
  }

  const { id, init } = node

  return Option.flatMap(Option.fromNullishOr(init), (value) =>
    wideningDiagnostic(
      sourceCode,
      value,
      annotationTarget(id.typeAnnotation, environment),
      `binding \`${id.name}\``,
    ),
  )
}

function propertyDiagnostic(
  sourceCode: OxlintSourceCode,
  node: ESTree.Node,
  environment: TypeEnvironment,
): Option.Option<Diagnostic.Diagnostic> {
  if (node.type !== 'PropertyDefinition' && node.type !== 'AccessorProperty') {
    return Option.none()
  }

  const { key, typeAnnotation, value } = node

  return Option.flatMap(Option.fromNullishOr(value), (initializer) =>
    wideningDiagnostic(
      sourceCode,
      initializer,
      annotationTarget(typeAnnotation, environment),
      `property \`${sourceKeyName(sourceCode, key)}\``,
    ),
  )
}

function assignmentDiagnostic(
  sourceCode: OxlintSourceCode,
  node: ESTree.Node,
  environment: TypeEnvironment,
): Option.Option<Diagnostic.Diagnostic> {
  if (
    node.type !== 'AssignmentExpression' ||
    node.operator !== '=' ||
    node.left.type !== 'Identifier'
  ) {
    return Option.none()
  }

  const { left, right } = node

  return annotatedBindingOfReference(sourceCode, left).pipe(
    Option.flatMap((id) =>
      wideningDiagnostic(
        sourceCode,
        right,
        annotationTarget(id.typeAnnotation, environment),
        `binding \`${id.name}\``,
      ),
    ),
  )
}

function annotatedBindingOfReference(
  sourceCode: OxlintSourceCode,
  identifier: ESTree.IdentifierReference,
): Option.Option<ESTree.BindingIdentifier> {
  return resolvedVariableForIdentifier(sourceCode.scopeManager.scopes, identifier).pipe(
    Option.filter((variable) => variable.defs.length === 1),
    Option.flatMap(variableDeclarator),
    Option.flatMap((declarator) =>
      declarator.id.type === 'Identifier' ? Option.some(declarator.id) : Option.none(),
    ),
  )
}

function returnDiagnostic(
  sourceCode: OxlintSourceCode,
  node: ESTree.Node,
  environment: TypeEnvironment,
): Option.Option<Diagnostic.Diagnostic> {
  if (node.type !== 'ReturnStatement') {
    return Option.none()
  }

  const owner = enclosingFunction(node)

  return Option.flatMap(Option.fromNullishOr(node.argument), (argument) =>
    wideningDiagnostic(
      sourceCode,
      argument,
      returnTypeTarget(owner, environment),
      `return value of \`${functionName(sourceCode, owner)}\``,
    ),
  )
}

function expressionBodyDiagnostic(
  sourceCode: OxlintSourceCode,
  node: ESTree.Node,
  environment: TypeEnvironment,
): Option.Option<Diagnostic.Diagnostic> {
  if (node.type !== 'ArrowFunctionExpression') {
    return Option.none()
  }

  const { body, returnType } = node

  if (body.type === 'BlockStatement') {
    return Option.none()
  }

  return wideningDiagnostic(
    sourceCode,
    body,
    annotationTarget(returnType, environment),
    `return value of \`${functionName(sourceCode, Option.some(node))}\``,
  )
}

function assertionDiagnostic(
  sourceCode: OxlintSourceCode,
  node: ESTree.Node,
  environment: TypeEnvironment,
): Option.Option<Diagnostic.Diagnostic> {
  if (!isTypeAssertion(node) || isTypeAssertion(node.parent)) {
    return Option.none()
  }

  return wideningDiagnostic(
    sourceCode,
    node.expression,
    classifyWideningTarget(node.typeAnnotation, environment),
    ASSERTION_SUBJECT,
  )
}

export default Rule.define({
  name: 'no-known-value-widening',
  meta: Rule.meta({
    type: 'problem',
    description: 'forbid widening a value of known shape into a broad annotation',
    messages: { knownValueWidening: MESSAGE },
  }),
  create: function* () {
    const context = yield* RuleContext
    const environment = yield* Ref.make(EMPTY_TYPE_ENVIRONMENT)

    const report = (diagnose: Diagnose) => (node: ESTree.Node) =>
      Ref.get(environment).pipe(
        Effect.flatMap((known) =>
          Option.match(diagnose(context.sourceCode, node, known), {
            onNone: () => Effect.void,
            onSome: context.report,
          }),
        ),
      )

    const reportProperty = report(propertyDiagnostic)
    const reportAssertion = report(assertionDiagnostic)

    return {
      Program: (node: ESTree.Node) => Ref.set(environment, createTypeEnvironment(node)),
      VariableDeclarator: report(bindingDiagnostic),
      PropertyDefinition: reportProperty,
      AccessorProperty: reportProperty,
      AssignmentExpression: report(assignmentDiagnostic),
      ReturnStatement: report(returnDiagnostic),
      ArrowFunctionExpression: report(expressionBodyDiagnostic),
      TSAsExpression: reportAssertion,
      TSTypeAssertion: reportAssertion,
    }
  },
})
