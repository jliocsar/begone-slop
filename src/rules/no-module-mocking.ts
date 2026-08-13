import * as Arr from 'effect/Array'
import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Predicate from 'effect/Predicate'
import {
  type Definition,
  Diagnostic,
  type ESTree,
  type OxlintSourceCode,
  Rule,
  RuleContext,
  Scope,
} from 'effect-oxlint'

const RUNNER_GLOBALS = new Set(['vi', 'jest'])

const VITEST_AND_JEST_METHODS = new Set(['doMock', 'mock', 'unstable_mockModule'])

const BUN_METHODS = new Set(['module'])

const RUNNER_IMPORTS = [
  { source: 'vitest', imported: 'vi', methods: VITEST_AND_JEST_METHODS },
  { source: '@jest/globals', imported: 'jest', methods: VITEST_AND_JEST_METHODS },
  { source: 'bun:test', imported: 'mock', methods: BUN_METHODS },
]

const MESSAGE =
  'Replace module mocking with dependency injection through a real interface, service layer, or faithful test implementation.'

function importedName(specifier: ESTree.Node): Option.Option<string> {
  if (specifier.type !== 'ImportSpecifier') {
    return Option.none()
  }

  const { imported } = specifier

  return Option.some(imported.type === 'Identifier' ? imported.name : imported.value)
}

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

function methodName(callee: ESTree.MemberExpression): Option.Option<string> {
  if (callee.computed) {
    const { property } = callee

    return property.type === 'Literal' && Predicate.isString(property.value)
      ? Option.some(property.value)
      : Option.none()
  }

  return callee.property.type === 'Identifier' ? Option.some(callee.property.name) : Option.none()
}

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
