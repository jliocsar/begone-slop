import type { ESTree, Scope, SourceCode, Variable } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
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
  readonly type: ESTree.TSType | undefined
}

type WidenedBinding = {
  readonly broadKind: BroadTypeKind
  readonly evidence: KnownValueEvidence
  readonly declaredAt: number
  readonly boundary: ESTree.Node | undefined
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

function annotationEvidence(
  identifier: ESTree.Node,
  annotation: ESTree.TSType,
  boundary: ESTree.Node | undefined,
): KnownValueEvidence | undefined {
  return hasSameBoundary(functionBoundary(identifier), boundary) &&
    broadTypeKind(annotation) === undefined
    ? { type: annotation }
    : undefined
}

function knownValueEvidence(
  expression: ESTree.Expression,
  scopes: readonly Scope[],
  boundary: ESTree.Node | undefined,
  visitedVariables: ReadonlySet<Variable>,
): KnownValueEvidence | undefined {
  if (isTypeAssertion(expression)) {
    return broadTypeKind(expression.typeAnnotation) === undefined
      ? { type: expression.typeAnnotation }
      : undefined
  }

  if (SYNTACTIC_VALUE_EXPRESSIONS.has(expression.type)) {
    return { type: undefined }
  }

  if (expression.type !== 'Identifier') {
    return undefined
  }

  const variable = resolvedVariableForIdentifier(scopes, expression)

  if (variable === undefined || visitedVariables.has(variable)) {
    return undefined
  }

  const binding = annotatedBinding(variable)

  if (binding === undefined) {
    return initializerEvidence(variable, scopes, boundary, visitedVariables)
  }

  return annotationEvidence(binding.identifier, binding.annotation, boundary)
}

function initializerEvidence(
  variable: Variable,
  scopes: readonly Scope[],
  boundary: ESTree.Node | undefined,
  visitedVariables: ReadonlySet<Variable>,
): KnownValueEvidence | undefined {
  const declarator = variableDeclarator(variable)

  if (
    declarator === undefined ||
    !isConstDeclarator(declarator) ||
    isReassigned(variable) ||
    !hasSameBoundary(functionBoundary(declarator), boundary) ||
    declarator.init === null
  ) {
    return undefined
  }

  return knownValueEvidence(
    declarator.init,
    scopes,
    boundary,
    new Set([...visitedVariables, variable]),
  )
}

function initializerWidening(
  init: ESTree.Expression,
): { readonly assertion: TypeAssertion; readonly kind: BroadTypeKind } | undefined {
  if (!isTypeAssertion(init)) {
    return undefined
  }

  const kind = broadTypeKind(init.typeAnnotation)

  return kind === undefined ? undefined : { assertion: init, kind }
}

function declaredTypeKind(declarator: ESTree.VariableDeclarator): BroadTypeKind | undefined {
  if (declarator.id.type !== 'Identifier') {
    return undefined
  }

  const annotation = declarator.id.typeAnnotation

  return annotation === null || annotation === undefined
    ? undefined
    : broadTypeKind(annotation.typeAnnotation)
}

function widenedFromInitializer(
  declarator: ESTree.VariableDeclarator,
  init: ESTree.Expression,
  scopes: readonly Scope[],
  variable: Variable,
): WidenedBinding | undefined {
  const widening = initializerWidening(init)
  const boundary = functionBoundary(declarator)
  const preWidening = widening === undefined ? init : widening.assertion.expression
  const broadKind = declaredTypeKind(declarator) ?? widening?.kind

  if (broadKind === undefined) {
    return undefined
  }

  const evidence = knownValueEvidence(preWidening, scopes, boundary, new Set([variable]))

  return evidence === undefined
    ? undefined
    : { broadKind, evidence, declaredAt: declarator.end, boundary }
}

function widenedBinding(variable: Variable, scopes: readonly Scope[]): WidenedBinding | undefined {
  const declarator = variableDeclarator(variable)

  if (
    declarator === undefined ||
    !isConstDeclarator(declarator) ||
    declarator.id.type !== 'Identifier' ||
    isReassigned(variable) ||
    declarator.init === null
  ) {
    return undefined
  }

  return widenedFromInitializer(declarator, declarator.init, scopes, variable)
}

function assertionIsNarrower(
  sourceText: string,
  widened: WidenedBinding,
  assertedType: ESTree.TSType,
): boolean {
  const evidenceType = widened.evidence.type
  const recreatesEvidence =
    evidenceType !== undefined && typesHaveSameSyntax(sourceText, evidenceType, assertedType)

  if (broadTypeKind(assertedType) !== undefined) {
    return false
  }

  if (widened.broadKind === 'top' || recreatesEvidence) {
    return true
  }

  return widened.broadKind === 'object'
    ? isDefinitelyObjectType(assertedType)
    : isDefinitelyNarrowerRecordType(assertedType)
}

function isWidenThenAssert(
  sourceCode: SourceCode,
  node: TypeAssertion,
  expression: ESTree.IdentifierReference,
): boolean {
  const { scopes } = sourceCode.scopeManager
  const variable = resolvedVariableForIdentifier(scopes, expression)
  const widened = variable === undefined ? undefined : widenedBinding(variable, scopes)

  return (
    widened !== undefined &&
    node.start > widened.declaredAt &&
    hasSameBoundary(functionBoundary(node), widened.boundary) &&
    assertionIsNarrower(sourceCode.text, widened, node.typeAnnotation)
  )
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid asserting a widened const binding back to a narrower type' },
    messages: { widenThenAssert: MESSAGE },
  },
  create(context) {
    const report = (node: TypeAssertion) => {
      const { expression } = node

      if (
        expression.type === 'Identifier' &&
        isWidenThenAssert(context.sourceCode, node, expression)
      ) {
        context.report({ node, messageId: 'widenThenAssert', data: { name: expression.name } })
      }
    }

    return { TSAsExpression: report, TSTypeAssertion: report }
  },
})
