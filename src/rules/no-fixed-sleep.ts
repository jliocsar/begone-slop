import type { Diagnostic, ESTree, SourceCode } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import {
  ALLOWLIST_MESSAGES,
  ALLOWLIST_PROPERTIES,
  reportBeyondAllowance,
} from '../shared/allowlist.ts'
import { rootIdentifierName } from '../shared/call-root.ts'
import { enclosingFunction } from '../shared/enclosing-function.ts'
import { namesTheGlobal } from '../shared/global-reference.ts'

type TimerBindings = {
  readonly sleeps: Set<string>
  readonly schedulers: Set<string>
  readonly modules: Set<string>
}

const TEST_CALLEES = new Set(['afterAll', 'afterEach', 'beforeAll', 'beforeEach', 'it', 'test'])
const TIMER_PROMISE_MODULES = new Set(['node:timers/promises', 'timers/promises'])
const FAKE_TIMER_RUNNERS = new Set(['jest', 'vi'])
const SET_TIMEOUT = 'setTimeout'
const SCHEDULER = 'scheduler'
const WAIT = 'wait'
const BUN = 'Bun'
const SLEEP = 'sleep'
const GLOBAL_THIS = 'globalThis'
const PROMISE = 'Promise'
const FAKE_TIMERS = 'useFakeTimers'

const MESSAGE =
  'A fixed sleep guesses how long the work takes, and under load it guesses wrong. Wait for the thing itself, through the promise the operation returns or one its callback resolves. To move time, use fake timers.'

function propertyName(node: ESTree.Node): string | undefined {
  if (node.type !== 'MemberExpression' || node.computed) {
    return undefined
  }

  return node.property.type === 'Identifier' ? node.property.name : undefined
}

function objectName(node: ESTree.Node): string | undefined {
  if (node.type !== 'MemberExpression') {
    return undefined
  }

  return node.object.type === 'Identifier' ? node.object.name : undefined
}

function isFakeTimersCall(node: ESTree.CallExpression): boolean {
  return (
    propertyName(node.callee) === FAKE_TIMERS &&
    FAKE_TIMER_RUNNERS.has(objectName(node.callee) ?? '')
  )
}

function isTestBody(owner: ESTree.Node): boolean {
  const call = owner.parent

  return (
    call?.type === 'CallExpression' &&
    call.callee !== owner &&
    TEST_CALLEES.has(rootIdentifierName(call.callee) ?? '')
  )
}

function importedName(specifier: ESTree.ImportSpecifier): string {
  const { imported } = specifier

  return imported.type === 'Identifier' ? imported.name : imported.value
}

function collectTimerImports(bindings: TimerBindings, node: ESTree.ImportDeclaration): void {
  if (!TIMER_PROMISE_MODULES.has(node.source.value)) {
    return
  }

  for (const specifier of node.specifiers) {
    if (specifier.type !== 'ImportSpecifier') {
      bindings.modules.add(specifier.local.name)
    } else if (importedName(specifier) === SET_TIMEOUT) {
      bindings.sleeps.add(specifier.local.name)
    } else if (importedName(specifier) === SCHEDULER) {
      bindings.schedulers.add(specifier.local.name)
    }
  }
}

function isSchedulerWait(bindings: TimerBindings, callee: ESTree.Node): boolean {
  if (propertyName(callee) !== WAIT || callee.type !== 'MemberExpression') {
    return false
  }

  const scheduler = callee.object

  if (scheduler.type === 'Identifier') {
    return bindings.schedulers.has(scheduler.name)
  }

  return propertyName(scheduler) === SCHEDULER && bindings.modules.has(objectName(scheduler) ?? '')
}

function isTimerSleep(
  sourceCode: SourceCode,
  bindings: TimerBindings,
  call: ESTree.CallExpression,
): boolean {
  const { callee } = call

  if (callee.type === 'Identifier') {
    return bindings.sleeps.has(callee.name)
  }

  if (propertyName(callee) === SET_TIMEOUT && bindings.modules.has(objectName(callee) ?? '')) {
    return true
  }

  if (callee.type === 'MemberExpression' && propertyName(callee) === SLEEP) {
    return namesTheGlobal(sourceCode, callee.object, BUN)
  }

  return isSchedulerWait(bindings, callee)
}

function isGlobalSetTimeout(sourceCode: SourceCode, callee: ESTree.Node): boolean {
  if (callee.type === 'MemberExpression') {
    return (
      propertyName(callee) === SET_TIMEOUT && namesTheGlobal(sourceCode, callee.object, GLOBAL_THIS)
    )
  }

  return namesTheGlobal(sourceCode, callee, SET_TIMEOUT)
}

function scheduledCall(body: ESTree.Node | null): ESTree.Node | undefined {
  if (body === null) {
    return undefined
  }

  if (body.type !== 'BlockStatement') {
    return body
  }

  const [statement] = body.body

  return body.body.length === 1 && statement?.type === 'ExpressionStatement'
    ? statement.expression
    : undefined
}

function callsResolve(handler: ESTree.Node | undefined, resolve: string): boolean {
  if (handler?.type === 'Identifier') {
    return handler.name === resolve
  }

  if (handler?.type !== 'ArrowFunctionExpression' && handler?.type !== 'FunctionExpression') {
    return false
  }

  const call = scheduledCall(handler.body)

  return (
    call?.type === 'CallExpression' &&
    call.callee.type === 'Identifier' &&
    call.callee.name === resolve
  )
}

function isPromisedTimeout(sourceCode: SourceCode, node: ESTree.NewExpression): boolean {
  const [executor] = node.arguments

  if (!namesTheGlobal(sourceCode, node.callee, PROMISE)) {
    return false
  }

  if (executor?.type !== 'ArrowFunctionExpression' && executor?.type !== 'FunctionExpression') {
    return false
  }

  const [resolve] = executor.params
  const timer = scheduledCall(executor.body)

  if (resolve?.type !== 'Identifier' || timer?.type !== 'CallExpression') {
    return false
  }

  return (
    isGlobalSetTimeout(sourceCode, timer.callee) && callsResolve(timer.arguments[0], resolve.name)
  )
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid awaiting a fixed sleep inside a test or hook' },
    messages: { fixedSleep: MESSAGE, ...ALLOWLIST_MESSAGES },
    schema: [{ type: 'object', properties: ALLOWLIST_PROPERTIES, additionalProperties: false }],
  },
  create(context) {
    const { sourceCode } = context
    const bindings: TimerBindings = { sleeps: new Set(), schedulers: new Set(), modules: new Set() }
    const awaitsInTests: ESTree.AwaitExpression[] = []
    const fakeTimerCalls: ESTree.CallExpression[] = []

    const isSleep = (node: ESTree.Node) => {
      if (node.type === 'NewExpression') {
        return isPromisedTimeout(sourceCode, node)
      }

      return node.type === 'CallExpression' && isTimerSleep(sourceCode, bindings, node)
    }

    return {
      ImportDeclaration(node) {
        collectTimerImports(bindings, node)
      },
      CallExpression(node) {
        if (isFakeTimersCall(node)) {
          fakeTimerCalls.push(node)
        }
      },
      AwaitExpression(node) {
        const owner = enclosingFunction(node)

        if (owner !== undefined && isTestBody(owner)) {
          awaitsInTests.push(node)
        }
      },
      'Program:exit'(program) {
        const diagnostics = awaitsInTests
          .filter((candidate) => fakeTimerCalls.length === 0 && isSleep(candidate.argument))
          .map((node): Diagnostic => ({ node, messageId: 'fixedSleep' }))

        reportBeyondAllowance(context, program, diagnostics)
      },
    }
  },
})
