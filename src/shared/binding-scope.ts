import * as Arr from 'effect/Array'
import * as Option from 'effect/Option'
import type { ESTree, OxlintScope, Variable } from 'effect-oxlint'

const FUNCTION_BOUNDARY_TYPES = new Set([
  'ArrowFunctionExpression',
  'FunctionDeclaration',
  'FunctionExpression',
  'TSDeclareFunction',
  'TSEmptyBodyFunctionExpression',
])

export function functionBoundary(node: ESTree.Node): Option.Option<ESTree.Node> {
  const { parent } = node

  if (parent === null || parent.type === 'Program') {
    return Option.none()
  }

  return FUNCTION_BOUNDARY_TYPES.has(parent.type) ? Option.some(parent) : functionBoundary(parent)
}

export function hasSameBoundary(
  left: Option.Option<ESTree.Node>,
  right: Option.Option<ESTree.Node>,
): boolean {
  return Option.getOrUndefined(left) === Option.getOrUndefined(right)
}

export function resolvedVariableForIdentifier(
  scopes: readonly OxlintScope[],
  identifier: ESTree.IdentifierReference,
): Option.Option<Variable> {
  return Arr.findFirst(
    Arr.flatMap(scopes, (scope) => scope.references),
    (reference) =>
      reference.identifier.start === identifier.start &&
      reference.identifier.end === identifier.end,
  ).pipe(Option.flatMap((reference) => Option.fromNullishOr(reference.resolved)))
}

export function variableDeclarator(variable: Variable): Option.Option<ESTree.VariableDeclarator> {
  return Arr.findFirst(variable.defs, (definition) =>
    definition.type === 'Variable' && definition.node.type === 'VariableDeclarator'
      ? Option.some(definition.node)
      : Option.none(),
  )
}

export function isConstDeclarator(declarator: ESTree.VariableDeclarator): boolean {
  const { parent } = declarator

  return parent.type === 'VariableDeclaration' && parent.kind === 'const'
}

export function isReassigned(variable: Variable): boolean {
  return Arr.some(variable.references, (reference) => reference.isWrite() && !reference.init)
}

export function annotatedBinding(
  variable: Variable,
): Option.Option<{ readonly identifier: ESTree.Node; readonly annotation: ESTree.TSType }> {
  return Arr.findFirst(variable.identifiers, (identifier) =>
    Option.map(Option.fromNullishOr(identifier.typeAnnotation), (annotation) => ({
      identifier,
      annotation: annotation.typeAnnotation,
    })),
  )
}
