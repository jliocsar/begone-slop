import type { ESTree, SourceCode } from '@oxlint/plugins'
import { findVariable } from './binding-scope.ts'

const REFLECT = 'Reflect'

function namesTheGlobalReflect(sourceCode: SourceCode, object: ESTree.Node): boolean {
  if (object.type !== 'Identifier' || object.name !== REFLECT) {
    return false
  }

  if (sourceCode.isGlobalReference(object)) {
    return true
  }

  const variable = findVariable(sourceCode.getScope(object), REFLECT)

  return variable === undefined || variable.defs.length === 0
}

export function isGlobalReflectMethodCall(
  sourceCode: SourceCode,
  callee: ESTree.Node,
  methodName: string,
): boolean {
  if (callee.type !== 'MemberExpression' || !namesTheGlobalReflect(sourceCode, callee.object)) {
    return false
  }

  const { property } = callee

  return callee.computed
    ? property.type === 'Literal' && property.value === methodName
    : property.type === 'Identifier' && property.name === methodName
}
