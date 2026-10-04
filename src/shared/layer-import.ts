import type { Definition, ESTree, SourceCode } from '@oxlint/plugins'
import { findVariable } from './binding-scope.ts'

const LAYER_BINDING = 'Layer'

const EFFECT_PACKAGE = 'effect'

const EFFECT_LAYER_MODULE = 'effect/Layer'

function namesTheLayerExport(imported: ESTree.ModuleExportName): boolean {
  return imported.type === 'Identifier'
    ? imported.name === LAYER_BINDING
    : imported.value === LAYER_BINDING
}

function bindsEffectLayer(definition: Definition): boolean {
  const declaration = definition.parent

  if (definition.type !== 'ImportBinding' || declaration?.type !== 'ImportDeclaration') {
    return false
  }

  const specifier = definition.node

  if (specifier.type === 'ImportSpecifier') {
    return declaration.source.value === EFFECT_PACKAGE && namesTheLayerExport(specifier.imported)
  }

  return (
    specifier.type === 'ImportNamespaceSpecifier' &&
    declaration.source.value === EFFECT_LAYER_MODULE &&
    specifier.local.name === LAYER_BINDING
  )
}

export function isEffectLayerReference(sourceCode: SourceCode, node: ESTree.Node): boolean {
  if (node.type !== 'Identifier') {
    return false
  }

  const variable = findVariable(sourceCode.getScope(node), node.name)

  return variable !== undefined && variable.defs.some(bindsEffectLayer)
}
