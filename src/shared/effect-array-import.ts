import type { ESTree } from '@oxlint/plugins'

export const EFFECT_ARRAY_BINDING = 'Array'

const EFFECT_PACKAGE = 'effect'

const EFFECT_ARRAY_MODULE = 'effect/Array'

function bindsBarrelArray(specifier: ESTree.ImportDeclarationSpecifier): boolean {
  return (
    specifier.type === 'ImportSpecifier' &&
    specifier.imported.type === 'Identifier' &&
    specifier.imported.name === EFFECT_ARRAY_BINDING &&
    specifier.local.name === EFFECT_ARRAY_BINDING
  )
}

function bindsLeafArray(specifier: ESTree.ImportDeclarationSpecifier): boolean {
  return (
    specifier.type === 'ImportNamespaceSpecifier' && specifier.local.name === EFFECT_ARRAY_BINDING
  )
}

function bindsArrayUnaliased(declaration: ESTree.ImportDeclaration): boolean {
  const source = declaration.source.value

  return (
    (source === EFFECT_PACKAGE && declaration.specifiers.some(bindsBarrelArray)) ||
    (source === EFFECT_ARRAY_MODULE && declaration.specifiers.some(bindsLeafArray))
  )
}

export function importsEffectArrayUnaliased(program: ESTree.Program): boolean {
  return program.body.some(
    (statement) => statement.type === 'ImportDeclaration' && bindsArrayUnaliased(statement),
  )
}
