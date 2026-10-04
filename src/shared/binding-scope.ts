import type { ESTree, Scope, Variable } from '@oxlint/plugins'

const FUNCTION_BOUNDARY_TYPES = new Set([
  'ArrowFunctionExpression',
  'FunctionDeclaration',
  'FunctionExpression',
  'TSDeclareFunction',
  'TSEmptyBodyFunctionExpression',
])

export function findVariable(scope: Scope, name: string): Variable | undefined {
  const variable = scope.set.get(name)

  if (variable !== undefined) {
    return variable
  }

  return scope.upper === null ? undefined : findVariable(scope.upper, name)
}

export function functionBoundary(node: ESTree.Node): ESTree.Node | undefined {
  const { parent } = node

  if (parent === null || parent.type === 'Program') {
    return undefined
  }

  return FUNCTION_BOUNDARY_TYPES.has(parent.type) ? parent : functionBoundary(parent)
}

export function hasSameBoundary(
  left: ESTree.Node | undefined,
  right: ESTree.Node | undefined,
): boolean {
  return left === right
}

export function resolvedVariableForIdentifier(
  scopes: readonly Scope[],
  identifier: ESTree.IdentifierReference,
): Variable | undefined {
  const reference = scopes
    .flatMap((scope) => scope.references)
    .find(
      (candidate) =>
        candidate.identifier.start === identifier.start &&
        candidate.identifier.end === identifier.end,
    )

  return reference?.resolved ?? undefined
}

export function variableDeclarator(variable: Variable): ESTree.VariableDeclarator | undefined {
  for (const definition of variable.defs) {
    if (definition.type === 'Variable' && definition.node.type === 'VariableDeclarator') {
      return definition.node
    }
  }

  return undefined
}

export function isConstDeclarator(declarator: ESTree.VariableDeclarator): boolean {
  const { parent } = declarator

  return parent.type === 'VariableDeclaration' && parent.kind === 'const'
}

export function isReassigned(variable: Variable): boolean {
  return variable.references.some((reference) => reference.isWrite() && !reference.init)
}

export function annotatedBinding(
  variable: Variable,
): { readonly identifier: ESTree.Node; readonly annotation: ESTree.TSType } | undefined {
  for (const identifier of variable.identifiers) {
    const annotation = identifier.typeAnnotation

    if (annotation !== null && annotation !== undefined) {
      return { identifier, annotation: annotation.typeAnnotation }
    }
  }

  return undefined
}
