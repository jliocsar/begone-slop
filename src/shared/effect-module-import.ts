import type { Definition, ESTree, SourceCode } from '@oxlint/plugins'
import { findVariable } from './binding-scope.ts'
import { stringLiteralValue } from './literal.ts'

const EFFECT_PACKAGE = 'effect'
const TYPE_ONLY = 'type'

function namesTheExport(imported: ESTree.ModuleExportName, exportName: string): boolean {
  return imported.type === 'Identifier'
    ? imported.name === exportName
    : imported.value === exportName
}

function bindsEffectModule(definition: Definition, moduleName: string): boolean {
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
      namesTheExport(specifier.imported, moduleName)
    )
  }

  return (
    specifier.type === 'ImportNamespaceSpecifier' &&
    declaration.source.value === `${EFFECT_PACKAGE}/${moduleName}`
  )
}

function staticMemberName(node: ESTree.MemberExpression): string | undefined {
  if (node.computed) {
    return stringLiteralValue(node.property)
  }

  return node.property.type === 'Identifier' ? node.property.name : undefined
}

function isEffectModuleReference(
  sourceCode: SourceCode,
  node: ESTree.Node,
  moduleName: string,
): boolean {
  if (node.type !== 'Identifier') {
    return false
  }

  const variable = findVariable(sourceCode.getScope(node), node.name)

  return (
    variable !== undefined &&
    variable.defs.some((definition) => bindsEffectModule(definition, moduleName))
  )
}

export function effectModuleMemberName(
  sourceCode: SourceCode,
  node: ESTree.Node,
  moduleName: string,
): string | undefined {
  if (
    node.type !== 'MemberExpression' ||
    !isEffectModuleReference(sourceCode, node.object, moduleName)
  ) {
    return undefined
  }

  return staticMemberName(node)
}
