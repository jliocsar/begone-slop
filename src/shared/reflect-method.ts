import * as Option from 'effect/Option'
import * as Predicate from 'effect/Predicate'
import { type ESTree, type OxlintSourceCode, Scope } from 'effect-oxlint'

const REFLECT = 'Reflect'

function namesTheGlobalReflect(sourceCode: OxlintSourceCode, object: ESTree.Node): boolean {
  if (object.type !== 'Identifier' || object.name !== REFLECT) {
    return false
  }

  if (sourceCode.isGlobalReference(object)) {
    return true
  }

  return Option.match(Scope.findVariableUp(sourceCode.getScope(object), REFLECT), {
    onNone: () => true,
    onSome: (variable) => variable.defs.length === 0,
  })
}

export function isGlobalReflectMethodCall(
  sourceCode: OxlintSourceCode,
  callee: ESTree.Expression,
  methodName: string,
): boolean {
  if (
    !Predicate.hasProperty(callee, 'property') ||
    !Predicate.hasProperty(callee, 'object') ||
    !Predicate.hasProperty(callee, 'computed')
  ) {
    return false
  }

  if (!namesTheGlobalReflect(sourceCode, callee.object)) {
    return false
  }

  const { property } = callee

  return callee.computed
    ? property.type === 'Literal' && property.value === methodName
    : property.type === 'Identifier' && property.name === methodName
}
