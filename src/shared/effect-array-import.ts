import * as Arr from 'effect/Array'
import type { ESTree } from 'effect-oxlint'

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
    (source === EFFECT_PACKAGE && Arr.some(declaration.specifiers, bindsBarrelArray)) ||
    (source === EFFECT_ARRAY_MODULE && Arr.some(declaration.specifiers, bindsLeafArray))
  )
}

export function importsEffectArrayUnaliased(program: ESTree.Node): boolean {
  if (program.type !== 'Program') {
    return false
  }

  return Arr.some(
    program.body,
    (statement) => statement.type === 'ImportDeclaration' && bindsArrayUnaliased(statement),
  )
}
