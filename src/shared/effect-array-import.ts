/**
 * Shared gate for the `Array` rules: does this file bind effect's `Array`
 * module under the name `Array`, shadowing the global one? Two spellings do it —
 * the barrel's named export, and the leaf namespace import this repo's own style
 * mandates. An aliased import shadows nothing and is exempt in both spellings
 * (`import { Array as Arr } from 'effect'`, `import * as Arr from 'effect/Array'`).
 *
 * Read from the Program body in one pass rather than latched while traversing.
 * The originals flipped a boolean inside an `ImportDeclaration` handler, so any
 * node visited before the import escaped the rule.
 */

import * as Arr from 'effect/Array'
import type { ESTree } from 'effect-oxlint'

export const EFFECT_ARRAY_BINDING = 'Array'

const EFFECT_PACKAGE = 'effect'

const EFFECT_ARRAY_MODULE = 'effect/Array'

/** `import { Array } from 'effect'` — the barrel, banned here but still checked. */
function bindsBarrelArray(specifier: ESTree.ImportDeclarationSpecifier): boolean {
  return (
    specifier.type === 'ImportSpecifier' &&
    specifier.imported.type === 'Identifier' &&
    specifier.imported.name === EFFECT_ARRAY_BINDING &&
    specifier.local.name === EFFECT_ARRAY_BINDING
  )
}

/** `import * as Array from 'effect/Array'` — leaf imports are the house form. */
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

/** Whether this Program binds effect's `Array` module under its own name. */
export function importsEffectArrayUnaliased(program: ESTree.Node): boolean {
  if (program.type !== 'Program') {
    return false
  }

  return Arr.some(
    program.body,
    (statement) => statement.type === 'ImportDeclaration' && bindsArrayUnaliased(statement),
  )
}
