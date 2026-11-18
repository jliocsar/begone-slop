import type { Diagnostic, ESTree } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import {
  ALLOWLIST_MESSAGES,
  ALLOWLIST_PROPERTIES,
  reportBeyondAllowance,
} from '../shared/allowlist.ts'
import { rootIdentifierName } from '../shared/call-root.ts'
import { staticKeyName } from '../shared/literal.ts'

const TEST_FUNCTIONS = new Set(['describe', 'it', 'suite', 'test'])
const TEST_BUILDERS = new Set(['each', 'extend', 'for', 'override', 'scoped'])
const VITEST_RUNNERS = new Set(['vi', 'vitest'])
const JEST_RUNNERS = new Set(['jest'])
const CONFIG_TIMEOUTS = new Set(['hookTimeout', 'testTimeout'])
const TEST_TIMEOUTS = new Set(['timeout'])
const NO_TIMEOUTS = new Set<string>()
const FUNCTION_TYPES = new Set(['ArrowFunctionExpression', 'FunctionExpression'])
const RETRY = 'retry'
const SET_CONFIG = 'setConfig'
const TEST_CONFIG = 'test'
const JEST_RETRY = 'retryTimes'
const JEST_TIMEOUT = 'setTimeout'
const BUN_TIMEOUT = 'setDefaultTimeout'

const RETRY_MESSAGE =
  'A test that passes on a second run failed the first time for a reason, and a retry hides it. Find what the test races and wait on that instead.'

const TIMEOUT_MESSAGE =
  'A longer timeout only gives a racing or slow test more room to fail later. Make the test wait for what it actually needs, and put expensive shared setup in beforeAll.'

function propertyName(node: ESTree.Node): string | undefined {
  if (node.type !== 'MemberExpression' || node.computed) {
    return undefined
  }

  return node.property.type === 'Identifier' ? node.property.name : undefined
}

function isTestCall(node: ESTree.CallExpression): boolean {
  return (
    TEST_FUNCTIONS.has(rootIdentifierName(node.callee) ?? '') &&
    !TEST_BUILDERS.has(propertyName(node.callee) ?? '')
  )
}

function isRunnerCall(
  node: ESTree.CallExpression,
  runners: ReadonlySet<string>,
  method: string,
): boolean {
  const { callee } = node

  return (
    propertyName(callee) === method &&
    callee.type === 'MemberExpression' &&
    callee.object.type === 'Identifier' &&
    runners.has(callee.object.name)
  )
}

function keyOf(property: ESTree.Node): string | undefined {
  return property.type === 'Property' ? staticKeyName(property.key, property.computed) : undefined
}

function objectProperties(node: ESTree.Node | undefined): readonly ESTree.Node[] {
  return node?.type === 'ObjectExpression' ? node.properties : []
}

function isBunDefaultTimeout(node: ESTree.CallExpression): boolean {
  return node.callee.type === 'Identifier' && node.callee.name === BUN_TIMEOUT
}

function isTimeoutArgument(node: ESTree.Node | undefined): node is ESTree.Node {
  return node !== undefined && node.type !== 'ObjectExpression' && !FUNCTION_TYPES.has(node.type)
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid test retries and raised test timeouts' },
    messages: { retry: RETRY_MESSAGE, timeout: TIMEOUT_MESSAGE, ...ALLOWLIST_MESSAGES },
    schema: [{ type: 'object', properties: ALLOWLIST_PROPERTIES, additionalProperties: false }],
  },
  create(context) {
    const diagnostics: Diagnostic[] = []

    const reportOptions = (node: ESTree.Node | undefined, timeouts: ReadonlySet<string>) => {
      for (const property of objectProperties(node)) {
        const key = keyOf(property)

        if (key === RETRY) {
          diagnostics.push({ node: property, messageId: 'retry' })
        } else if (key !== undefined && timeouts.has(key)) {
          diagnostics.push({ node: property, messageId: 'timeout' })
        }
      }
    }

    const reportTestCall = (node: ESTree.CallExpression) => {
      const [, second, third] = node.arguments

      reportOptions(second, TEST_TIMEOUTS)

      reportOptions(third, TEST_TIMEOUTS)

      if (second?.type !== 'ObjectExpression' && isTimeoutArgument(third)) {
        diagnostics.push({ node: third, messageId: 'timeout' })
      }
    }

    return {
      CallExpression(node) {
        if (isRunnerCall(node, VITEST_RUNNERS, SET_CONFIG)) {
          reportOptions(node.arguments[0], CONFIG_TIMEOUTS)
        } else if (isRunnerCall(node, JEST_RUNNERS, JEST_RETRY)) {
          diagnostics.push({ node, messageId: 'retry' })
        } else if (isRunnerCall(node, JEST_RUNNERS, JEST_TIMEOUT) || isBunDefaultTimeout(node)) {
          diagnostics.push({ node, messageId: 'timeout' })
        } else if (isTestCall(node)) {
          reportTestCall(node)
        }
      },
      Property(node) {
        if (keyOf(node) === TEST_CONFIG) {
          reportOptions(node.value, NO_TIMEOUTS)
        }
      },
      'Program:exit'(program) {
        reportBeyondAllowance(context, program, diagnostics)
      },
    }
  },
})
