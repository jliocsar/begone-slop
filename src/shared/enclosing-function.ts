import * as Option from 'effect/Option'
import type { ESTree, OxlintSourceCode } from 'effect-oxlint'

export type FunctionOwner = ESTree.ArrowFunctionExpression | ESTree.Function

const ANONYMOUS_FUNCTION_NAME = 'anonymous function'

function isFunctionOwner(node: ESTree.Node): node is FunctionOwner {
  return (
    node.type === 'ArrowFunctionExpression' ||
    node.type === 'FunctionDeclaration' ||
    node.type === 'FunctionExpression'
  )
}

export function enclosingFunction(node: ESTree.Node): Option.Option<FunctionOwner> {
  const { parent } = node

  if (parent === null || parent.type === 'Program') {
    return Option.none()
  }

  return isFunctionOwner(parent) ? Option.some(parent) : enclosingFunction(parent)
}

export function sourceKeyName(sourceCode: OxlintSourceCode, key: ESTree.PropertyKey): string {
  if (key.type === 'Identifier' || key.type === 'PrivateIdentifier') {
    return key.name
  }

  return key.type === 'Literal' ? String(key.value) : sourceCode.getText(key)
}

function inheritedFunctionName(
  sourceCode: OxlintSourceCode,
  owner: FunctionOwner,
): Option.Option<string> {
  const { parent } = owner

  if (parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier') {
    return Option.some(parent.id.name)
  }

  return parent.type === 'MethodDefinition'
    ? Option.some(sourceKeyName(sourceCode, parent.key))
    : Option.none()
}

export function functionName(
  sourceCode: OxlintSourceCode,
  owner: Option.Option<FunctionOwner>,
): string {
  return Option.flatMap(owner, (fn) =>
    Option.orElse(
      Option.map(Option.fromNullishOr(fn.id), (id) => id.name),
      () => inheritedFunctionName(sourceCode, fn),
    ),
  ).pipe(Option.getOrElse(() => ANONYMOUS_FUNCTION_NAME))
}
