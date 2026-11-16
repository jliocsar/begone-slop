import type { ESTree, SourceCode } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { functionBoundary } from '../shared/binding-scope.ts'
import { effectModuleMemberName, isImportedFromEffect } from '../shared/effect-module-import.ts'
import { earlierPipeSteps } from '../shared/pipe-steps.ts'
import type { FunctionOwner } from '../shared/enclosing-function.ts'
import { stringLiteralValue } from '../shared/literal.ts'
import { isNodeOfType } from '../shared/node-type.ts'
import {
  outermostTransparentWrapper,
  unwrapTransparentExpression,
} from '../shared/transparent-expression.ts'

type ErrorConstruction = ESTree.CallExpression | ESTree.NewExpression

type Narrowing = {
  readonly operator: string
  readonly call: ESTree.CallExpression
  readonly handler: FunctionOwner
}

type MissingCause = {
  readonly operator: string
  readonly error: string
}

const EFFECT_MODULE = 'Effect'
const CAUSE = 'cause'
const MAKE = 'make'
const FAIL = 'fail'
const GEN = 'gen'
const CAPITALISED = /^[A-Z]/u
const TAP_OPERATORS = new Set(['tapCause', 'tapError', 'tapErrorCause'])

const NARROWING_OPERATORS = new Set([
  'catch',
  'catchAll',
  'catchAllCause',
  'catchCause',
  'mapError',
  'orElse',
])

const MESSAGE =
  'This `Effect.{{operator}}` handler never reads the error it replaces, so `{{error}}` loses the original failure. Name the parameter and pass it on as `cause`, or log it with `Effect.tapError` before narrowing.'

function trailingName(node: ESTree.Node): string | undefined {
  if (node.type === 'Identifier') {
    return node.name
  }

  if (node.type !== 'MemberExpression' || node.computed) {
    return undefined
  }

  return node.property.type === 'Identifier' ? node.property.name : undefined
}

function constructedOwner(node: ErrorConstruction): ESTree.Node | undefined {
  if (node.type === 'NewExpression') {
    return node.callee
  }

  const callee = unwrapTransparentExpression(node.callee)

  return callee.type === 'MemberExpression' && trailingName(callee) === MAKE
    ? callee.object
    : undefined
}

function constructedError(sourceCode: SourceCode, node: ErrorConstruction): string | undefined {
  const owner = constructedOwner(node)
  const constructor = owner === undefined ? undefined : unwrapTransparentExpression(owner)
  const name = constructor === undefined ? undefined : trailingName(constructor)

  if (
    constructor === undefined ||
    name === undefined ||
    !CAPITALISED.test(name) ||
    isImportedFromEffect(sourceCode, constructor)
  ) {
    return undefined
  }

  return sourceCode.getText(constructor)
}

function namesTheCause(property: ESTree.Node): boolean {
  if (property.type === 'SpreadElement') {
    return true
  }

  if (property.type !== 'Property') {
    return false
  }

  const keyName = property.computed ? stringLiteralValue(property.key) : trailingName(property.key)

  return keyName === CAUSE
}

function passesCause(node: ErrorConstruction): boolean {
  return node.arguments.some(
    (argument) => argument.type === 'ObjectExpression' && argument.properties.some(namesTheCause),
  )
}

function isGeneratorOf(
  sourceCode: SourceCode,
  owner: FunctionOwner,
): ESTree.CallExpression | undefined {
  const { parent } = owner

  if (
    owner.type !== 'FunctionExpression' ||
    !owner.generator ||
    parent.type !== 'CallExpression' ||
    effectModuleMemberName(sourceCode, parent.callee, EFFECT_MODULE) !== GEN
  ) {
    return undefined
  }

  return parent
}

function isFailingPosition(
  sourceCode: SourceCode,
  holder: ESTree.Node,
  value: ESTree.Node,
): boolean {
  if (holder.type === 'ReturnStatement') {
    return true
  }

  if (holder.type === 'YieldExpression') {
    return holder.delegate
  }

  return (
    holder.type === 'CallExpression' &&
    holder.arguments[0] === value &&
    effectModuleMemberName(sourceCode, holder.callee, EFFECT_MODULE) === FAIL
  )
}

function enclosingProducer(
  sourceCode: SourceCode,
  holder: ESTree.Node,
  value: ESTree.Node,
): ESTree.Node | undefined {
  if (holder.type === 'ArrowFunctionExpression' && holder.body === value) {
    return holder
  }

  return isFailingPosition(sourceCode, holder, value) ? functionBoundary(holder) : undefined
}

function producingFunction(sourceCode: SourceCode, node: ESTree.Node): FunctionOwner | undefined {
  const value = outermostTransparentWrapper(node)
  const holder = value.parent

  if (holder === null) {
    return undefined
  }

  const boundary = enclosingProducer(sourceCode, holder, value)

  if (
    boundary === undefined ||
    !isNodeOfType(boundary, ['ArrowFunctionExpression', 'FunctionExpression'])
  ) {
    return undefined
  }

  const generatorCall = isGeneratorOf(sourceCode, boundary)

  return generatorCall === undefined ? boundary : producingFunction(sourceCode, generatorCall)
}

function narrowingOf(sourceCode: SourceCode, handler: FunctionOwner): Narrowing | undefined {
  const argument = outermostTransparentWrapper(handler)
  const call = argument.parent

  if (call?.type !== 'CallExpression' || call.arguments.at(-1) !== argument) {
    return undefined
  }

  const operator = effectModuleMemberName(sourceCode, call.callee, EFFECT_MODULE)

  if (operator === undefined || !NARROWING_OPERATORS.has(operator)) {
    return undefined
  }

  return { operator, call, handler }
}

function ignoresError(sourceCode: SourceCode, handler: FunctionOwner): boolean {
  const [parameter] = handler.params

  if (parameter === undefined) {
    return true
  }

  const variable = sourceCode
    .getDeclaredVariables(handler)
    .find((candidate) => candidate.identifiers.some((identifier) => identifier === parameter))

  return parameter.type === 'Identifier' && variable?.references.length === 0
}

function isTapStep(sourceCode: SourceCode, node: ESTree.Node): boolean {
  const step = unwrapTransparentExpression(node)
  const callee = step.type === 'CallExpression' ? step.callee : step
  const operator = effectModuleMemberName(sourceCode, callee, EFFECT_MODULE)

  return operator !== undefined && TAP_OPERATORS.has(operator)
}

function missingCause(sourceCode: SourceCode, node: ErrorConstruction): MissingCause | undefined {
  const error = constructedError(sourceCode, node)

  if (error === undefined || passesCause(node)) {
    return undefined
  }

  const handler = producingFunction(sourceCode, node)
  const narrowing = handler === undefined ? undefined : narrowingOf(sourceCode, handler)

  if (
    narrowing === undefined ||
    !ignoresError(sourceCode, narrowing.handler) ||
    earlierPipeSteps(narrowing.call).some((step) => isTapStep(sourceCode, step))
  ) {
    return undefined
  }

  return { operator: narrowing.operator, error }
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'require an Effect handler that replaces an error it never reads to keep it as `cause`',
    },
    messages: { missingCause: MESSAGE },
  },
  create(context) {
    const { sourceCode } = context

    const check = (node: ErrorConstruction) => {
      const missing = missingCause(sourceCode, node)

      if (missing !== undefined) {
        context.report({ node, messageId: 'missingCause', data: missing })
      }
    }

    return { CallExpression: check, NewExpression: check }
  },
})
