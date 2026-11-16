import type { ESTree, SourceCode } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { effectModuleMemberName, namesEffectModuleType } from '../shared/effect-module-import.ts'
import { isNodeOfType } from '../shared/node-type.ts'
import { outermostTransparentWrapper } from '../shared/transparent-expression.ts'
import { isTestFile } from '../shared/test-file.ts'

type Signature =
  | ESTree.ArrowFunctionExpression
  | ESTree.Function
  | ESTree.TSFunctionType
  | ESTree.TSMethodSignature

const LAYER_MODULE = 'Layer'
const CARRIER_MODULES = ['Context', 'Layer', 'ManagedRuntime']
const EFFECT_API_MODULES = ['Context', 'Effect', 'Layer', 'ManagedRuntime']

const MESSAGE =
  'A `{{type}}` parameter hands the caller wiring to the callee. Resolve services once in the owning service `make`, wire layers once at the edge, and pass plain values.'

function carrierModule(sourceCode: SourceCode, annotation: ESTree.TSType): string | undefined {
  if (annotation.type !== 'TSTypeReference' || annotation.typeName.type !== 'TSQualifiedName') {
    return undefined
  }

  const { left, right } = annotation.typeName

  return CARRIER_MODULES.find(
    (module) => right.name === module && namesEffectModuleType(sourceCode, left, module),
  )
}

function parameterAnnotation(parameter: ESTree.Node): ESTree.TSType | undefined {
  if (parameter.type === 'TSParameterProperty') {
    return parameterAnnotation(parameter.parameter)
  }

  if (parameter.type === 'AssignmentPattern') {
    return parameterAnnotation(parameter.left)
  }

  if (!isNodeOfType(parameter, ['Identifier', 'ObjectPattern', 'ArrayPattern', 'RestElement'])) {
    return undefined
  }

  return parameter.typeAnnotation?.typeAnnotation ?? undefined
}

function isLayerExpression(sourceCode: SourceCode, node: ESTree.Node): boolean {
  if (node.type !== 'CallExpression') {
    return false
  }

  if (effectModuleMemberName(sourceCode, node.callee, LAYER_MODULE) !== undefined) {
    return true
  }

  return (
    node.callee.type === 'MemberExpression' &&
    (isLayerExpression(sourceCode, node.callee.object) ||
      node.arguments.some((argument) => isLayerExpression(sourceCode, argument)))
  )
}

function buildsALayer(sourceCode: SourceCode, signature: Signature): boolean {
  const returnType = signature.returnType?.typeAnnotation

  if (returnType !== undefined && carrierModule(sourceCode, returnType) === LAYER_MODULE) {
    return true
  }

  return (
    signature.type === 'ArrowFunctionExpression' &&
    signature.expression &&
    isLayerExpression(sourceCode, signature.body)
  )
}

function isEffectApiCallback(sourceCode: SourceCode, signature: Signature): boolean {
  const argument = outermostTransparentWrapper(signature)
  const call = argument.parent

  return (
    call?.type === 'CallExpression' &&
    call.arguments.some((candidate) => candidate === argument) &&
    EFFECT_API_MODULES.some(
      (module) => effectModuleMemberName(sourceCode, call.callee, module) !== undefined,
    )
  )
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: {
      description:
        'forbid parameters typed `Context.Context`, `Layer.Layer` or `ManagedRuntime.ManagedRuntime`',
    },
    messages: { serviceCarrierParameter: MESSAGE },
  },
  create(context) {
    const { sourceCode } = context

    if (isTestFile(context.filename)) {
      return {}
    }

    const check = (signature: Signature) => {
      if (isEffectApiCallback(sourceCode, signature)) {
        return
      }

      for (const parameter of signature.params) {
        const annotation = parameterAnnotation(parameter)
        const module = annotation === undefined ? undefined : carrierModule(sourceCode, annotation)
        const layerCombinator = module === LAYER_MODULE && buildsALayer(sourceCode, signature)

        if (annotation?.type === 'TSTypeReference' && module !== undefined && !layerCombinator) {
          const type = sourceCode.getText(annotation.typeName)

          context.report({ node: parameter, messageId: 'serviceCarrierParameter', data: { type } })
        }
      }
    }

    return {
      ArrowFunctionExpression: check,
      FunctionDeclaration: check,
      FunctionExpression: check,
      TSFunctionType: check,
      TSMethodSignature: check,
    }
  },
})
