import type { ESTree, SourceCode } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import { effectModuleMemberName } from '../shared/effect-module-import.ts'
import { isEffectLayerReference } from '../shared/layer-import.ts'
import { stringLiteralValue } from '../shared/literal.ts'

const CONTEXT_MODULE = 'Context'
const SERVICE_MEMBER = 'Service'
const PROVISIONING_METHODS = new Set(['provide', 'provideMerge'])
const FUNCTION_TYPES = new Set(['ArrowFunctionExpression', 'FunctionExpression'])

const MESSAGE =
  "A service's own layer that provides its dependencies can't be built over fakes: a dependency provided inside a layer stays the one it gets, whatever a test provides around it. Leave the requirements open and wire them where the program is assembled."

function namesAProvisioningMethod(property: ESTree.Node): boolean {
  if (property.type === 'Identifier') {
    return PROVISIONING_METHODS.has(property.name)
  }

  const literalName = stringLiteralValue(property)

  return literalName !== undefined && PROVISIONING_METHODS.has(literalName)
}

function isLayerProvision(sourceCode: SourceCode, node: ESTree.CallExpression): boolean {
  const { callee } = node

  return (
    callee.type === 'MemberExpression' &&
    isEffectLayerReference(sourceCode, callee.object) &&
    namesAProvisioningMethod(callee.property)
  )
}

function isContextServiceCall(sourceCode: SourceCode, node: ESTree.Node | null): boolean {
  if (node === null) {
    return false
  }

  if (node.type === 'MemberExpression') {
    return effectModuleMemberName(sourceCode, node, CONTEXT_MODULE) === SERVICE_MEMBER
  }

  if (node.type === 'CallExpression' || node.type === 'TSInstantiationExpression') {
    return isContextServiceCall(
      sourceCode,
      node.type === 'CallExpression' ? node.callee : node.expression,
    )
  }

  return false
}

function isServiceClassBody(sourceCode: SourceCode, node: ESTree.Node): boolean {
  const owner = node.parent

  return (
    node.type === 'ClassBody' &&
    (owner?.type === 'ClassDeclaration' || owner?.type === 'ClassExpression') &&
    isContextServiceCall(sourceCode, owner.superClass)
  )
}

function enclosingStaticServiceProperty(
  sourceCode: SourceCode,
  node: ESTree.Node,
): ESTree.Node | undefined {
  const { parent } = node

  if (parent === null || parent === undefined || FUNCTION_TYPES.has(parent.type)) {
    return undefined
  }

  if (parent.type === 'PropertyDefinition' && parent.value === node) {
    return parent.static && isServiceClassBody(sourceCode, parent.parent) ? parent : undefined
  }

  return enclosingStaticServiceProperty(sourceCode, parent)
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: "forbid a service's static layer providing its own dependencies" },
    messages: { serviceLayerProvide: MESSAGE },
  },
  create(context) {
    const { sourceCode } = context

    return {
      CallExpression(node) {
        if (
          isLayerProvision(sourceCode, node) &&
          enclosingStaticServiceProperty(sourceCode, node) !== undefined
        ) {
          context.report({ node, messageId: 'serviceLayerProvide' })
        }
      },
    }
  },
})
