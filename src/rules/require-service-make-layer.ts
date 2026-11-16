import type { ESTree, SourceCode } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import {
  isServiceClass,
  optionProperty,
  serviceOptions,
  staticMember,
} from '../shared/service-class.ts'

const MAKE = 'make'
const LAYER = 'layer'
const UNNAMED_SERVICE = 'This service'

const MESSAGE =
  '{{service}} has a `make` but no `static readonly layer`. Add one, such as `static readonly layer = Layer.effect(this, this.make)`, so the program and its tests build the service the same way.'

function serviceName(service: ESTree.Class): string {
  const { parent } = service

  if (service.id !== null && service.id !== undefined) {
    return `\`${service.id.name}\``
  }

  return parent.type === 'VariableDeclarator' && parent.id.type === 'Identifier'
    ? `\`${parent.id.name}\``
    : UNNAMED_SERVICE
}

function lacksLayer(sourceCode: SourceCode, node: ESTree.Class): boolean {
  if (!isServiceClass(sourceCode, node)) {
    return false
  }

  const hasMake =
    optionProperty(serviceOptions(node), MAKE) !== undefined ||
    staticMember(node, MAKE) !== undefined

  return hasMake && staticMember(node, LAYER) === undefined
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'require a `Context.Service` with a `make` to declare a `static layer`' },
    messages: { missingLayer: MESSAGE },
  },
  create(context) {
    const check = (node: ESTree.Class) => {
      if (lacksLayer(context.sourceCode, node)) {
        context.report({
          node: node.id ?? node,
          messageId: 'missingLayer',
          data: { service: serviceName(node) },
        })
      }
    }

    return { ClassDeclaration: check, ClassExpression: check }
  },
})
