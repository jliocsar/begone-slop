import type { ESTree, SourceCode } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { effectModuleMemberName } from '../shared/effect-module-import.ts'
import { stringLiteralValue } from '../shared/literal.ts'
import { isServiceClass } from '../shared/service-class.ts'
import { returnedExpressions, serviceOperations } from '../shared/service-operations.ts'
import { unwrapTransparentExpression } from '../shared/transparent-expression.ts'
import { isTestFile } from '../shared/test-file.ts'

const EFFECT_MODULE = 'Effect'
const FN = 'fn'
const WITH_SPAN = 'withSpan'
const PIPE = 'pipe'
const UNNAMED_SERVICE = 'Service'

const MESSAGE =
  '`{{service}}.{{operation}}` runs without a span, so a trace cannot show it. Define it with `Effect.fn("{{service}}.{{operation}}")(function* () { … })`, or end its pipe with `Effect.withSpan`.'

function isSpanCall(sourceCode: SourceCode, node: ESTree.CallExpression): boolean {
  const member = effectModuleMemberName(sourceCode, node.callee, EFFECT_MODULE)

  if (member === WITH_SPAN) {
    return true
  }

  const [name] = node.arguments

  return (
    member === FN &&
    name !== undefined &&
    (stringLiteralValue(name) !== undefined || name.type === 'TemplateLiteral')
  )
}

function isEffectCall(sourceCode: SourceCode, node: ESTree.Node): boolean {
  const expression = unwrapTransparentExpression(node)

  if (expression.type !== 'CallExpression') {
    return false
  }

  const { callee } = expression

  if (effectModuleMemberName(sourceCode, callee, EFFECT_MODULE) !== undefined) {
    return true
  }

  if (callee.type === 'CallExpression') {
    return isEffectCall(sourceCode, callee)
  }

  return (
    callee.type === 'MemberExpression' &&
    callee.property.type === 'Identifier' &&
    callee.property.name === PIPE &&
    (isEffectCall(sourceCode, callee.object) ||
      expression.arguments.some((step) => isEffectCall(sourceCode, step)))
  )
}

function isOperation(sourceCode: SourceCode, node: ESTree.Node): boolean {
  if (node.type === 'ArrowFunctionExpression' || node.type === 'FunctionExpression') {
    return returnedExpressions(node).some((returned) => isEffectCall(sourceCode, returned))
  }

  return isEffectCall(sourceCode, node)
}

function contains(outer: ESTree.Node, inner: ESTree.Node): boolean {
  return inner.start >= outer.start && inner.end <= outer.end
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: "require every operation a service's `make` returns to carry a span" },
    messages: { missingSpan: MESSAGE },
  },
  create(context) {
    const { sourceCode } = context

    if (isTestFile(context.filename)) {
      return {}
    }

    const spans: ESTree.CallExpression[] = []
    const services: ESTree.Class[] = []

    const collectService = (node: ESTree.Class) => {
      if (isServiceClass(sourceCode, node)) {
        services.push(node)
      }
    }

    return {
      CallExpression(node) {
        if (isSpanCall(sourceCode, node)) {
          spans.push(node)
        }
      },
      ClassDeclaration: collectService,
      ClassExpression: collectService,
      'Program:exit'() {
        for (const service of services) {
          const serviceName = service.id?.name ?? UNNAMED_SERVICE

          for (const operation of serviceOperations(sourceCode, service)) {
            if (
              isOperation(sourceCode, operation.value) &&
              !spans.some((span) => contains(operation.value, span))
            ) {
              context.report({
                node: operation.property,
                messageId: 'missingSpan',
                data: { service: serviceName, operation: operation.name },
              })
            }
          }
        }
      },
    }
  },
})
