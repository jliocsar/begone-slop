/**
 * Module mocking replaces a module's exports behind the import graph, so the
 * test proves the mock's behaviour and nothing about the real seam. Inject the
 * dependency instead — a real interface, a service layer, or a test
 * implementation that keeps the contract.
 *
 * Three runners, matched on the IMPORTED name so an alias is caught too:
 * `vi.mock`/`vi.doMock`/`vi.unstable_mockModule` from `vitest`, the same three
 * on `jest` from `@jest/globals`, and `mock.module` from `bun:test`. `vi` and
 * `jest` count as the runner's globals when nothing local defines them, which is
 * how both are normally written.
 *
 * Bun is a divergence from the original rule, which knew only vitest and jest:
 * this repo runs `bun:test`, so a 1:1 port could never fire here. Bare `mock()`
 * mocks a function rather than a module and stays legal — only the `.module`
 * member call is module mocking.
 *
 * Report-only — the replacement is the seam the test should have used.
 */

import * as Arr from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import {
  type Definition,
  Diagnostic,
  type ESTree,
  type OxlintSourceCode,
  Rule,
  RuleContext,
  Scope,
} from 'effect-oxlint'

/** Both runners inject these, so a file mocking through them imports nothing. */
const RUNNER_GLOBALS = new Set(['vi', 'jest'])

const VITEST_AND_JEST_METHODS = new Set(['doMock', 'mock', 'unstable_mockModule'])

/** `mock()` alone mocks a function; only `mock.module()` rewires an import. */
const BUN_METHODS = new Set(['module'])

/** The mocker each runner exports, by the name the module exports it under. */
const RUNNER_IMPORTS = [
  { source: 'vitest', imported: 'vi', methods: VITEST_AND_JEST_METHODS },
  { source: '@jest/globals', imported: 'jest', methods: VITEST_AND_JEST_METHODS },
  { source: 'bun:test', imported: 'mock', methods: BUN_METHODS },
]

const MESSAGE =
  'Replace module mocking with dependency injection through a real interface, service layer, or faithful test implementation.'

/** `import { vi }` and `import { 'vi' as … }` name the same export. */
function importedName(specifier: ESTree.Node): Option.Option<string> {
  if (specifier.type !== 'ImportSpecifier') {
    return Option.none()
  }

  const { imported } = specifier

  return Option.some(imported.type === 'Identifier' ? imported.name : imported.value)
}

/** The methods this definition's import makes module mocking, if any. */
function importedRunnerMethods(definition: Definition): Option.Option<ReadonlySet<string>> {
  const declaration = definition.parent

  if (definition.type !== 'ImportBinding' || declaration?.type !== 'ImportDeclaration') {
    return Option.none()
  }

  return importedName(definition.node).pipe(
    Option.flatMap((name) =>
      Arr.findFirst(
        RUNNER_IMPORTS,
        (runner) => runner.source === declaration.source.value && runner.imported === name,
      ),
    ),
    Option.map((runner) => runner.methods),
  )
}

function globalRunnerMethods(name: string): Option.Option<ReadonlySet<string>> {
  return RUNNER_GLOBALS.has(name) ? Option.some(VITEST_AND_JEST_METHODS) : Option.none()
}

/**
 * A name the scope manager misses, or knows without a definition, is the
 * runner's global — an ambient declaration counts, and so does a bare `vi`.
 */
function resolvedRunnerMethods(
  sourceCode: OxlintSourceCode,
  object: ESTree.IdentifierReference,
): Option.Option<ReadonlySet<string>> {
  return Option.match(Scope.findVariableUp(sourceCode.getScope(object), object.name), {
    onNone: () => globalRunnerMethods(object.name),
    onSome: (variable) =>
      Arr.match(variable.defs, {
        onEmpty: () => globalRunnerMethods(object.name),
        onNonEmpty: (defs) => Arr.findFirst(defs, importedRunnerMethods),
      }),
  })
}

function runnerMethods(
  sourceCode: OxlintSourceCode,
  object: ESTree.Expression,
): Option.Option<ReadonlySet<string>> {
  if (object.type !== 'Identifier') {
    return Option.none()
  }

  const asGlobal = sourceCode.isGlobalReference(object)
    ? globalRunnerMethods(object.name)
    : Option.none<ReadonlySet<string>>()

  return asGlobal.pipe(Option.orElse(() => resolvedRunnerMethods(sourceCode, object)))
}

/** `mocker.module` and `mocker['module']` — the spelling is the caller's business. */
function methodName(callee: ESTree.MemberExpression): Option.Option<string> {
  if (callee.computed) {
    const { property } = callee

    return property.type === 'Literal' && typeof property.value === 'string'
      ? Option.some(property.value)
      : Option.none()
  }

  return callee.property.type === 'Identifier' ? Option.some(callee.property.name) : Option.none()
}

/**
 * A `Super` or `V8IntrinsicExpression` callee is excluded by the member-expression
 * check itself, which is where the original's explicit skip of both ends up.
 */
function isModuleMockCall(sourceCode: OxlintSourceCode, node: ESTree.Node): boolean {
  if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression') {
    return false
  }

  const { callee } = node

  return runnerMethods(sourceCode, callee.object).pipe(
    Option.flatMap((methods) =>
      methodName(callee).pipe(Option.filter((method) => methods.has(method))),
    ),
    Option.isSome,
  )
}

export default Rule.define({
  name: 'no-module-mocking',
  meta: Rule.meta({
    type: 'problem',
    description: 'forbid vitest, jest and bun module mocking',
    messages: { moduleMock: MESSAGE },
  }),
  create: function* () {
    const context = yield* RuleContext

    return {
      CallExpression: (node: ESTree.Node) =>
        isModuleMockCall(context.sourceCode, node)
          ? context.report(Diagnostic.fromId({ node, messageId: 'moduleMock' }))
          : Effect.void,
    }
  },
})
