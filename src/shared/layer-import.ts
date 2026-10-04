import type { Definition, ESTree, SourceCode } from '@oxlint/plugins'
import { findVariable } from './binding-scope.ts'

const LAYER_BINDING = 'Layer'

const PIPE = 'pipe'

const EFFECT_PACKAGE = 'effect'

const EFFECT_LAYER_MODULE = 'effect/Layer'

const PIPE_MODULES = new Set([EFFECT_PACKAGE, 'effect/Function'])

function namesTheExport(imported: ESTree.ModuleExportName, exportName: string): boolean {
  return imported.type === 'Identifier'
    ? imported.name === exportName
    : imported.value === exportName
}

function bindsEffectLayer(definition: Definition): boolean {
  const declaration = definition.parent

  if (definition.type !== 'ImportBinding' || declaration?.type !== 'ImportDeclaration') {
    return false
  }

  const specifier = definition.node

  if (specifier.type === 'ImportSpecifier') {
    return (
      declaration.source.value === EFFECT_PACKAGE &&
      namesTheExport(specifier.imported, LAYER_BINDING)
    )
  }

  return (
    specifier.type === 'ImportNamespaceSpecifier' &&
    declaration.source.value === EFFECT_LAYER_MODULE
  )
}

function bindsEffectPipe(definition: Definition): boolean {
  const declaration = definition.parent
  const specifier = definition.node

  return (
    definition.type === 'ImportBinding' &&
    declaration?.type === 'ImportDeclaration' &&
    specifier.type === 'ImportSpecifier' &&
    PIPE_MODULES.has(declaration.source.value) &&
    namesTheExport(specifier.imported, PIPE)
  )
}

function resolvesToImport(
  sourceCode: SourceCode,
  node: ESTree.Node,
  bindsTheImport: (definition: Definition) => boolean,
): boolean {
  if (node.type !== 'Identifier') {
    return false
  }

  const variable = findVariable(sourceCode.getScope(node), node.name)

  return variable !== undefined && variable.defs.some(bindsTheImport)
}

export function isEffectLayerReference(sourceCode: SourceCode, node: ESTree.Node): boolean {
  return resolvesToImport(sourceCode, node, bindsEffectLayer)
}

export function pipeStages(sourceCode: SourceCode, node: ESTree.Node): readonly ESTree.Node[] {
  if (node.type !== 'CallExpression') {
    return []
  }

  const { callee } = node

  if (
    callee.type === 'MemberExpression' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === PIPE
  ) {
    return node.arguments
  }

  return resolvesToImport(sourceCode, callee, bindsEffectPipe) ? node.arguments.slice(1) : []
}
