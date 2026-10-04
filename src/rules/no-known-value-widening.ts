import type { ESTree, SourceCode, Variable } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { resolvedVariableForIdentifier, variableDeclarator } from '../shared/binding-scope.ts'
import {
  enclosingFunction,
  type FunctionOwner,
  functionName,
  isOverloadImplementation,
  sourceKeyName,
} from '../shared/enclosing-function.ts'
import { hasKnownEvidence, isEmptyObjectExpression } from '../shared/known-evidence.ts'
import { isTypeAssertion, type TypeAssertion } from '../shared/type-assertion.ts'
import {
  createTypeEnvironment,
  EMPTY_TYPE_ENVIRONMENT,
  type TypeEnvironment,
} from '../shared/type-environment.ts'
import { classifyWideningTarget, type WideningTarget } from '../shared/widening-targets.ts'

type Widening = {
  readonly expression: ESTree.Expression
  readonly subject: string
  readonly target: WideningTarget
}

const MESSAGE =
  'The explicit {{target}} type on {{subject}} discards known type evidence. Keep inference, validate with `satisfies`, or use a named owner contract.'

const ASSERTION_SUBJECT = 'assertion'

const ACCUMULATOR_TARGET_KINDS = new Set(['generic container', 'open dictionary'])

function annotationTarget(
  annotation: ESTree.TSTypeAnnotation | null | undefined,
  environment: TypeEnvironment,
): WideningTarget | undefined {
  if (annotation === null || annotation === undefined) {
    return undefined
  }

  return classifyWideningTarget(annotation.typeAnnotation, environment)
}

function returnTypeTarget(
  sourceCode: SourceCode,
  owner: FunctionOwner | undefined,
  environment: TypeEnvironment,
): WideningTarget | undefined {
  return owner === undefined || isOverloadImplementation(sourceCode, owner)
    ? undefined
    : annotationTarget(owner.returnType, environment)
}

function wideningOf(
  sourceCode: SourceCode,
  expression: ESTree.Expression,
  target: WideningTarget | undefined,
  subject: string,
): Widening | undefined {
  if (
    target === undefined ||
    (ACCUMULATOR_TARGET_KINDS.has(target.kind) && isEmptyObjectExpression(expression)) ||
    !hasKnownEvidence(sourceCode.scopeManager.scopes, expression, new Set<Variable>())
  ) {
    return undefined
  }

  return { expression, subject, target }
}

function bindingWidening(
  sourceCode: SourceCode,
  node: ESTree.VariableDeclarator,
  environment: TypeEnvironment,
): Widening | undefined {
  const { id, init } = node

  if (id.type !== 'Identifier' || init === null) {
    return undefined
  }

  return wideningOf(
    sourceCode,
    init,
    annotationTarget(id.typeAnnotation, environment),
    `binding \`${id.name}\``,
  )
}

function propertyWidening(
  sourceCode: SourceCode,
  node: ESTree.PropertyDefinition | ESTree.AccessorProperty,
  environment: TypeEnvironment,
): Widening | undefined {
  const { key, typeAnnotation, value } = node

  if (value === null) {
    return undefined
  }

  return wideningOf(
    sourceCode,
    value,
    annotationTarget(typeAnnotation, environment),
    `property \`${sourceKeyName(sourceCode, key)}\``,
  )
}

function annotatedBindingOfReference(
  sourceCode: SourceCode,
  identifier: ESTree.IdentifierReference,
): ESTree.BindingIdentifier | undefined {
  const variable = resolvedVariableForIdentifier(sourceCode.scopeManager.scopes, identifier)

  if (variable === undefined || variable.defs.length !== 1) {
    return undefined
  }

  const declarator = variableDeclarator(variable)

  return declarator?.id.type === 'Identifier' ? declarator.id : undefined
}

function assignmentWidening(
  sourceCode: SourceCode,
  node: ESTree.AssignmentExpression,
  environment: TypeEnvironment,
): Widening | undefined {
  const { left, operator, right } = node

  if (operator !== '=' || left.type !== 'Identifier') {
    return undefined
  }

  const id = annotatedBindingOfReference(sourceCode, left)

  if (id === undefined) {
    return undefined
  }

  return wideningOf(
    sourceCode,
    right,
    annotationTarget(id.typeAnnotation, environment),
    `binding \`${id.name}\``,
  )
}

function returnWidening(
  sourceCode: SourceCode,
  node: ESTree.ReturnStatement,
  environment: TypeEnvironment,
): Widening | undefined {
  const { argument } = node

  if (argument === null) {
    return undefined
  }

  const owner = enclosingFunction(node)

  return wideningOf(
    sourceCode,
    argument,
    returnTypeTarget(sourceCode, owner, environment),
    `return value of \`${functionName(sourceCode, owner)}\``,
  )
}

function expressionBodyWidening(
  sourceCode: SourceCode,
  node: ESTree.ArrowFunctionExpression,
  environment: TypeEnvironment,
): Widening | undefined {
  const { body, returnType } = node

  if (body.type === 'BlockStatement') {
    return undefined
  }

  return wideningOf(
    sourceCode,
    body,
    annotationTarget(returnType, environment),
    `return value of \`${functionName(sourceCode, node)}\``,
  )
}

function assertionWidening(
  sourceCode: SourceCode,
  node: TypeAssertion,
  environment: TypeEnvironment,
): Widening | undefined {
  if (isTypeAssertion(node.parent)) {
    return undefined
  }

  return wideningOf(
    sourceCode,
    node.expression,
    classifyWideningTarget(node.typeAnnotation, environment),
    ASSERTION_SUBJECT,
  )
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid widening a value of known shape into a broad annotation' },
    messages: { knownValueWidening: MESSAGE },
  },
  create(context) {
    let environment = EMPTY_TYPE_ENVIRONMENT

    const report = (widening: Widening | undefined) => {
      if (widening !== undefined) {
        context.report({
          node: widening.expression,
          messageId: 'knownValueWidening',
          data: { subject: widening.subject, target: widening.target.kind },
        })
      }
    }

    const reportProperty = (node: ESTree.PropertyDefinition | ESTree.AccessorProperty) => {
      report(propertyWidening(context.sourceCode, node, environment))
    }

    const reportAssertion = (node: TypeAssertion) => {
      report(assertionWidening(context.sourceCode, node, environment))
    }

    return {
      Program(node) {
        environment = createTypeEnvironment(node)
      },
      VariableDeclarator(node) {
        report(bindingWidening(context.sourceCode, node, environment))
      },
      PropertyDefinition: reportProperty,
      AccessorProperty: reportProperty,
      AssignmentExpression(node) {
        report(assignmentWidening(context.sourceCode, node, environment))
      },
      ReturnStatement(node) {
        report(returnWidening(context.sourceCode, node, environment))
      },
      ArrowFunctionExpression(node) {
        report(expressionBodyWidening(context.sourceCode, node, environment))
      },
      TSAsExpression: reportAssertion,
      TSTypeAssertion: reportAssertion,
    }
  },
})
