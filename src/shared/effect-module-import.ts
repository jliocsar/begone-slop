import type { Definition, ESTree, SourceCode } from '@oxlint/plugins'
import { findVariable } from './binding-scope.ts'
import { stringLiteralValue } from './literal.ts'

const EFFECT_PACKAGE = 'effect'
const EFFECT_SUBPATH_PREFIX = 'effect/'
const EFFECT_SCOPE_PREFIX = '@effect/'
const TYPE_ONLY = 'type'

function namesTheExport(imported: ESTree.ModuleExportName, exportName: string): boolean {
  return imported.type === 'Identifier'
    ? imported.name === exportName
    : imported.value === exportName
}

function importsEffectModule(definition: Definition, moduleName: string): boolean {
  const declaration = definition.parent

  if (definition.type !== 'ImportBinding' || declaration?.type !== 'ImportDeclaration') {
    return false
  }

  const specifier = definition.node

  if (specifier.type === 'ImportSpecifier') {
    return (
      declaration.source.value === EFFECT_PACKAGE && namesTheExport(specifier.imported, moduleName)
    )
  }

  return (
    specifier.type === 'ImportNamespaceSpecifier' &&
    declaration.source.value === `${EFFECT_PACKAGE}/${moduleName}`
  )
}

function isTypeOnlyImport(definition: Definition): boolean {
  const declaration = definition.parent
  const specifier = definition.node

  return (
    declaration?.type === 'ImportDeclaration' &&
    (declaration.importKind === TYPE_ONLY ||
      (specifier.type === 'ImportSpecifier' && specifier.importKind === TYPE_ONLY))
  )
}

function bindsEffectModule(definition: Definition, moduleName: string): boolean {
  return importsEffectModule(definition, moduleName) && !isTypeOnlyImport(definition)
}

export function namesEffectModuleType(
  sourceCode: SourceCode,
  node: ESTree.Node,
  moduleName: string,
): boolean {
  if (node.type !== 'Identifier') {
    return false
  }

  const variable = findVariable(sourceCode.getScope(node), node.name)

  return variable?.defs.some((definition) => importsEffectModule(definition, moduleName)) ?? false
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

function rootObject(node: ESTree.Node): ESTree.Node {
  return node.type === 'MemberExpression' ? rootObject(node.object) : node
}

function isEffectPackage(source: string): boolean {
  return (
    source === EFFECT_PACKAGE ||
    source.startsWith(EFFECT_SUBPATH_PREFIX) ||
    source.startsWith(EFFECT_SCOPE_PREFIX)
  )
}

export function isImportedFromEffect(sourceCode: SourceCode, node: ESTree.Node): boolean {
  const root = rootObject(node)

  if (root.type !== 'Identifier') {
    return false
  }

  const variable = findVariable(sourceCode.getScope(root), root.name)

  return (
    variable?.defs.some(
      (definition) =>
        definition.type === 'ImportBinding' &&
        definition.parent?.type === 'ImportDeclaration' &&
        isEffectPackage(definition.parent.source.value),
    ) ?? false
  )
}
