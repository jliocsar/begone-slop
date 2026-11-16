import type { ESTree, SourceCode, Variable } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import {
  isGlobalStaticCall,
  isKnownArray,
  methodCall,
  type MethodCall,
} from '../shared/array-method.ts'
import { functionBoundary, isConstDeclarator } from '../shared/binding-scope.ts'
import type { FunctionOwner } from '../shared/enclosing-function.ts'
import { namesTheGlobal } from '../shared/global-reference.ts'
import { isNodeOfType } from '../shared/node-type.ts'
import {
  outermostTransparentWrapper,
  unwrapTransparentExpression,
} from '../shared/transparent-expression.ts'

type Reducer = {
  readonly callback: FunctionOwner
  readonly accumulator: Variable
  readonly startsAsArray: boolean
}

const REDUCER_METHODS = new Set(['reduce', 'reduceRight'])
const COPYING_CONSTRUCTORS = ['Map', 'Set']
const STRUCTURED_CLONE = 'structuredClone'

const COPYING_ARRAY_METHODS = new Set([
  'concat',
  'slice',
  'toReversed',
  'toSorted',
  'toSpliced',
  'with',
])

const MESSAGE =
  'This copies the accumulator on every step, so the reduce does quadratic work for a linear job. Build the result in one pass instead (`Object.fromEntries`, `flatMap`, `Map.groupBy`), or let the reducer own a single accumulator and update it in place.'

function accumulatorParameter(callback: FunctionOwner): ESTree.Node | undefined {
  const [parameter] = callback.params

  if (parameter?.type === 'AssignmentPattern') {
    return parameter.left
  }

  return parameter
}

function reducerOf(sourceCode: SourceCode, node: ESTree.CallExpression): Reducer | undefined {
  const method = methodCall(node)
  const [callbackArgument, initialValue] = node.arguments
  const callback =
    callbackArgument === undefined ? undefined : unwrapTransparentExpression(callbackArgument)

  if (
    method === undefined ||
    !REDUCER_METHODS.has(method.name) ||
    callback === undefined ||
    !isNodeOfType(callback, ['ArrowFunctionExpression', 'FunctionExpression'])
  ) {
    return undefined
  }

  const parameter = accumulatorParameter(callback)
  const accumulator = sourceCode
    .getDeclaredVariables(callback)
    .find((variable) => variable.identifiers.some((identifier) => identifier === parameter))

  if (parameter?.type !== 'Identifier' || accumulator === undefined) {
    return undefined
  }

  return {
    callback,
    accumulator,
    startsAsArray: initialValue !== undefined && isKnownArray(sourceCode, initialValue, new Set()),
  }
}

function copiesThroughCall(
  sourceCode: SourceCode,
  call: ESTree.CallExpression,
  value: ESTree.Node,
): boolean {
  const [first] = call.arguments

  if (namesTheGlobal(sourceCode, call.callee, STRUCTURED_CLONE)) {
    return first === value
  }

  const method = methodCall(call)

  if (method === undefined) {
    return false
  }

  if (isGlobalStaticCall(sourceCode, method, 'Array', 'from')) {
    return first === value
  }

  return (
    isGlobalStaticCall(sourceCode, method, 'Object', 'assign') &&
    first !== undefined &&
    first !== value &&
    unwrapTransparentExpression(first).type === 'ObjectExpression' &&
    call.arguments.some((argument) => argument === value)
  )
}

function copiesThroughMethod(
  member: ESTree.MemberExpression,
  reducer: Reducer,
): MethodCall | undefined {
  const call = member.parent
  const method = call?.type === 'CallExpression' ? methodCall(call) : undefined

  if (
    method === undefined ||
    method.call.callee !== member ||
    !reducer.startsAsArray ||
    !COPYING_ARRAY_METHODS.has(method.name)
  ) {
    return undefined
  }

  return method
}

function copyingConstruction(sourceCode: SourceCode, node: ESTree.NewExpression): boolean {
  return COPYING_CONSTRUCTORS.some((constructor) =>
    namesTheGlobal(sourceCode, node.callee, constructor),
  )
}

function copyOf(
  sourceCode: SourceCode,
  identifier: ESTree.Node,
  reducer: Reducer,
): ESTree.Node | undefined {
  const value = outermostTransparentWrapper(identifier)
  const { parent } = value

  if (parent === null) {
    return undefined
  }

  if (parent.type === 'SpreadElement') {
    const holder = parent.parent

    return isNodeOfType(holder, ['ArrayExpression', 'ObjectExpression']) ? holder : undefined
  }

  if (parent.type === 'MemberExpression' && parent.object === value) {
    return copiesThroughMethod(parent, reducer)?.call
  }

  if (parent.type === 'CallExpression') {
    return copiesThroughCall(sourceCode, parent, value) ? parent : undefined
  }

  return parent.type === 'NewExpression' &&
    parent.arguments[0] === value &&
    copyingConstruction(sourceCode, parent)
    ? parent
    : undefined
}

function constAlias(sourceCode: SourceCode, identifier: ESTree.Node): Variable | undefined {
  const value = outermostTransparentWrapper(identifier)
  const declarator = value.parent

  if (
    declarator?.type !== 'VariableDeclarator' ||
    declarator.init !== value ||
    declarator.id.type !== 'Identifier' ||
    !isConstDeclarator(declarator)
  ) {
    return undefined
  }

  return sourceCode.getDeclaredVariables(declarator)[0]
}

function accumulatorCopies(
  sourceCode: SourceCode,
  reducer: Reducer,
  variable: Variable,
  visited: Set<Variable>,
): readonly ESTree.Node[] {
  if (visited.has(variable)) {
    return []
  }

  visited.add(variable)

  return variable.references.flatMap(({ identifier }) => {
    if (functionBoundary(identifier) !== reducer.callback) {
      return []
    }

    const alias = constAlias(sourceCode, identifier)

    if (alias !== undefined) {
      return accumulatorCopies(sourceCode, reducer, alias, visited)
    }

    const copy = copyOf(sourceCode, identifier, reducer)

    return copy === undefined ? [] : [copy]
  })
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid copying the accumulator on every step of a reduce' },
    messages: { reduceAccumulatorCopy: MESSAGE },
  },
  create(context) {
    const { sourceCode } = context

    return {
      CallExpression(node) {
        const reducer = reducerOf(sourceCode, node)

        if (reducer === undefined) {
          return
        }

        const copies = new Set(
          accumulatorCopies(sourceCode, reducer, reducer.accumulator, new Set()),
        )

        for (const copy of copies) {
          context.report({ node: copy, messageId: 'reduceAccumulatorCopy' })
        }
      },
    }
  },
})
