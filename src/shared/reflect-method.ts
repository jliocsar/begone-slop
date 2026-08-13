/**
 * Shared receiver check for the `Reflect.*` rules: does this callee name a
 * method on the real global `Reflect`?
 *
 * A local `Reflect` — declared, imported or parameter-bound — is somebody's own
 * object and none of our business. `isGlobalReference` alone is not enough: a
 * name the scope manager knows but nothing defines (an ambient declaration, an
 * implicit global) still resolves to a variable, so a miss and a definition-less
 * variable both count as the global.
 */

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

/** Reports whether a call target names one method on the global Reflect object. */
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
