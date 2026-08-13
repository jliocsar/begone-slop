import * as Arr from 'effect/Array'
import * as Option from 'effect/Option'
import { type Definition, type ESTree, type OxlintSourceCode, Scope } from 'effect-oxlint'

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

export function isEffectLayerReference(sourceCode: OxlintSourceCode, node: ESTree.Node): boolean {
  if (node.type !== 'Identifier') {
    return false
  }

  return Option.match(Scope.findVariableUp(sourceCode.getScope(node), node.name), {
    onNone: () => false,
    onSome: (variable) => Arr.some(variable.defs, bindsEffectLayer),
  })
}
