import type { ESTree } from '@oxlint/plugins'
import {
  outermostTransparentWrapper,
  unwrapTransparentExpression,
} from './transparent-expression.ts'

const PIPE = 'pipe'

function isPipeMember(node: ESTree.Node): node is ESTree.MemberExpression {
  return (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.property.type === 'Identifier' &&
    node.property.name === PIPE
  )
}

function receiverPipeSteps(callee: ESTree.Node): readonly ESTree.Node[] {
  const member = unwrapTransparentExpression(callee)

  if (!isPipeMember(member)) {
    return []
  }

  const receiver = unwrapTransparentExpression(member.object)

  if (receiver.type !== 'CallExpression') {
    return [receiver]
  }

  return [receiver, ...receiver.arguments, ...receiverPipeSteps(receiver.callee)]
}

export function earlierPipeSteps(call: ESTree.CallExpression): readonly ESTree.Node[] {
  if (call.arguments.length > 1) {
    return call.arguments.slice(0, -1)
  }

  const step = outermostTransparentWrapper(call)
  const pipe = step.parent
  const index =
    pipe?.type === 'CallExpression' ? pipe.arguments.findIndex((argument) => argument === step) : -1

  if (pipe?.type !== 'CallExpression' || index === -1) {
    return []
  }

  return [...pipe.arguments.slice(0, index), ...receiverPipeSteps(pipe.callee)]
}
