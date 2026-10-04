import type { Definition, ESTree, SourceCode } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { findVariable } from '../shared/binding-scope.ts'
import { stringLiteralValue } from '../shared/literal.ts'

const RUNNER_GLOBALS = new Set(['vi', 'jest'])

const VITEST_AND_JEST_METHODS: ReadonlySet<string> = new Set([
  'doMock',
  'mock',
  'unstable_mockModule',
])

const BUN_METHODS: ReadonlySet<string> = new Set(['module'])

const RUNNER_IMPORTS = [
  { source: 'vitest', imported: 'vi', methods: VITEST_AND_JEST_METHODS },
  { source: '@jest/globals', imported: 'jest', methods: VITEST_AND_JEST_METHODS },
  { source: 'bun:test', imported: 'mock', methods: BUN_METHODS },
]

const MESSAGE =
  'Replace module mocking with dependency injection through a real interface, service layer, or faithful test implementation.'

function importedName(specifier: ESTree.Node): string | undefined {
  if (specifier.type !== 'ImportSpecifier') {
    return undefined
  }

  const { imported } = specifier

  return imported.type === 'Identifier' ? imported.name : imported.value
}

function importedRunnerMethods(definition: Definition): ReadonlySet<string> | undefined {
  const declaration = definition.parent

  if (definition.type !== 'ImportBinding' || declaration?.type !== 'ImportDeclaration') {
    return undefined
  }

  const name = importedName(definition.node)

  if (name === undefined) {
    return undefined
  }

  const runner = RUNNER_IMPORTS.find(
    (candidate) => candidate.source === declaration.source.value && candidate.imported === name,
  )

  return runner?.methods
}

function globalRunnerMethods(name: string): ReadonlySet<string> | undefined {
  return RUNNER_GLOBALS.has(name) ? VITEST_AND_JEST_METHODS : undefined
}

function resolvedRunnerMethods(
  sourceCode: SourceCode,
  object: ESTree.IdentifierReference,
): ReadonlySet<string> | undefined {
  const variable = findVariable(sourceCode.getScope(object), object.name)

  if (variable === undefined || variable.defs.length === 0) {
    return globalRunnerMethods(object.name)
  }

  for (const definition of variable.defs) {
    const methods = importedRunnerMethods(definition)

    if (methods !== undefined) {
      return methods
    }
  }

  return undefined
}

function runnerMethods(
  sourceCode: SourceCode,
  object: ESTree.Expression,
): ReadonlySet<string> | undefined {
  if (object.type !== 'Identifier') {
    return undefined
  }

  const asGlobal = sourceCode.isGlobalReference(object)
    ? globalRunnerMethods(object.name)
    : undefined

  return asGlobal ?? resolvedRunnerMethods(sourceCode, object)
}

function methodName(callee: ESTree.MemberExpression): string | undefined {
  if (callee.computed) {
    return stringLiteralValue(callee.property)
  }

  return callee.property.type === 'Identifier' ? callee.property.name : undefined
}

function isModuleMockCall(sourceCode: SourceCode, node: ESTree.CallExpression): boolean {
  const { callee } = node

  if (callee.type !== 'MemberExpression') {
    return false
  }

  const methods = runnerMethods(sourceCode, callee.object)
  const method = methodName(callee)

  return methods !== undefined && method !== undefined && methods.has(method)
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid vitest, jest and bun module mocking' },
    messages: { moduleMock: MESSAGE },
  },
  create(context) {
    return {
      CallExpression(node) {
        if (isModuleMockCall(context.sourceCode, node)) {
          context.report({ node, messageId: 'moduleMock' })
        }
      },
    }
  },
})
