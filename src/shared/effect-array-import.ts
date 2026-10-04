import type { Definition, ESTree, SourceCode } from '@oxlint/plugins'
import { findVariable } from './binding-scope.ts'

export const EFFECT_ARRAY_BINDING = 'Array'

const EFFECT_PACKAGE = 'effect'

const EFFECT_ARRAY_MODULE = 'effect/Array'

const TYPE_ONLY = 'type'

function bindsEffectArray(definition: Definition): boolean {
  const declaration = definition.parent

  if (
    definition.type !== 'ImportBinding' ||
    declaration?.type !== 'ImportDeclaration' ||
    declaration.importKind === TYPE_ONLY
  ) {
    return false
  }

  const specifier = definition.node

  if (specifier.type === 'ImportSpecifier') {
    return (
      specifier.importKind !== TYPE_ONLY &&
      declaration.source.value === EFFECT_PACKAGE &&
      specifier.imported.type === 'Identifier' &&
      specifier.imported.name === EFFECT_ARRAY_BINDING
    )
  }

  return (
    specifier.type === 'ImportNamespaceSpecifier' &&
    declaration.source.value === EFFECT_ARRAY_MODULE
  )
}

export function isEffectArrayReference(sourceCode: SourceCode, node: ESTree.Node): boolean {
  if (node.type !== 'Identifier') {
    return false
  }

  const variable = findVariable(sourceCode.getScope(node), node.name)

  return variable !== undefined && variable.defs.some(bindsEffectArray)
}
