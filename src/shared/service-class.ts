import type { ESTree, SourceCode } from '@oxlint/plugins'
import { effectModuleMemberName } from './effect-module-import.ts'
import { staticKeyName } from './literal.ts'
import { isNodeOfType } from './node-type.ts'

export type StaticMember = ESTree.MethodDefinition | ESTree.PropertyDefinition

const CONTEXT_MODULE = 'Context'
const SERVICE_MEMBER = 'Service'

export function isContextServiceCall(sourceCode: SourceCode, node: ESTree.Node | null): boolean {
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

export function isServiceClass(sourceCode: SourceCode, node: ESTree.Node): node is ESTree.Class {
  return (
    isNodeOfType(node, ['ClassDeclaration', 'ClassExpression']) &&
    isContextServiceCall(sourceCode, node.superClass)
  )
}

export function serviceOptions(service: ESTree.Class): ESTree.ObjectExpression | undefined {
  const { superClass } = service
  const options = superClass?.type === 'CallExpression' ? superClass.arguments[1] : undefined

  return options?.type === 'ObjectExpression' ? options : undefined
}

export function optionProperty(
  options: ESTree.ObjectExpression | undefined,
  name: string,
): ESTree.Node | undefined {
  for (const property of options?.properties ?? []) {
    if (property.type === 'Property' && staticKeyName(property.key, property.computed) === name) {
      return property.value
    }
  }

  return undefined
}

function isStaticMemberNamed(member: ESTree.Node, name: string): member is StaticMember {
  return (
    isNodeOfType(member, ['MethodDefinition', 'PropertyDefinition']) &&
    member.static &&
    staticKeyName(member.key, member.computed) === name
  )
}

export function staticMember(service: ESTree.Class, name: string): StaticMember | undefined {
  for (const member of service.body.body) {
    if (isStaticMemberNamed(member, name)) {
      return member
    }
  }

  return undefined
}
