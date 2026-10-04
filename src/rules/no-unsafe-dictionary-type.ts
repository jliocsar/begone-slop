import type { ESTree } from '@oxlint/plugins'
import { defineRule } from '@oxlint/plugins'
import {
  classifyUnsafeDictionary,
  classifyUnsafeDictionaryValue,
  type UnsafeValue,
} from '../shared/dictionary-types.ts'
import {
  createTypeEnvironment,
  EMPTY_TYPE_ENVIRONMENT,
  type TypeEnvironment,
  typeReferenceName,
} from '../shared/type-environment.ts'

const TYPE_NODE_KINDS = new Set([
  'JSDocNonNullableType',
  'JSDocNullableType',
  'JSDocUnknownType',
  'TSAnyKeyword',
  'TSArrayType',
  'TSBigIntKeyword',
  'TSBooleanKeyword',
  'TSConditionalType',
  'TSConstructorType',
  'TSFunctionType',
  'TSImportType',
  'TSIndexedAccessType',
  'TSInferType',
  'TSIntersectionType',
  'TSIntrinsicKeyword',
  'TSLiteralType',
  'TSMappedType',
  'TSNamedTupleMember',
  'TSNeverKeyword',
  'TSNullKeyword',
  'TSNumberKeyword',
  'TSObjectKeyword',
  'TSParenthesizedType',
  'TSStringKeyword',
  'TSSymbolKeyword',
  'TSTemplateLiteralType',
  'TSThisType',
  'TSTupleType',
  'TSTypeLiteral',
  'TSTypeOperator',
  'TSTypePredicate',
  'TSTypeQuery',
  'TSTypeReference',
  'TSUndefinedKeyword',
  'TSUnionType',
  'TSUnknownKeyword',
  'TSVoidKeyword',
])

const MESSAGE =
  "This dictionary's {{value}} value type gives callers no concrete value contract. Use an owner/schema-derived value type; parse external payloads before insertion."

function isTypeNode(node: ESTree.Node): node is ESTree.TSType {
  return TYPE_NODE_KINDS.has(node.type)
}

function isInsideTypeAliasDeclaration(node: ESTree.Node): boolean {
  const { parent } = node

  if (parent === null || parent.type === 'Program') {
    return false
  }

  return parent.type === 'TSTypeAliasDeclaration' || isInsideTypeAliasDeclaration(parent)
}

function isPlainAliasConsumerUse(node: ESTree.TSType, environment: TypeEnvironment): boolean {
  if (node.type !== 'TSTypeReference' || (node.typeArguments?.params.length ?? 0) > 0) {
    return false
  }

  const name = typeReferenceName(node)

  return name !== undefined && environment.aliases.has(name) && !isInsideTypeAliasDeclaration(node)
}

function hasUnsafeTypeAncestor(node: ESTree.Node, environment: TypeEnvironment): boolean {
  const { parent } = node

  if (parent === null || parent.type === 'Program') {
    return false
  }

  if (isTypeNode(parent) && classifyUnsafeDictionary(parent, environment) !== undefined) {
    return true
  }

  return hasUnsafeTypeAncestor(parent, environment)
}

function unsafeTypeValue(
  node: ESTree.TSType,
  environment: TypeEnvironment,
): UnsafeValue | undefined {
  if (isPlainAliasConsumerUse(node, environment)) {
    return undefined
  }

  const unsafe = classifyUnsafeDictionary(node, environment)

  if (unsafe === undefined || hasUnsafeTypeAncestor(node, environment)) {
    return undefined
  }

  return unsafe.unsafeValue
}

function unsafeIndexSignatureValue(
  node: ESTree.TSIndexSignature,
  environment: TypeEnvironment,
): UnsafeValue | undefined {
  if (node.parent.type === 'TSTypeLiteral') {
    return undefined
  }

  return classifyUnsafeDictionaryValue(node.typeAnnotation.typeAnnotation, environment)?.unsafeValue
}

export default defineRule({
  meta: {
    type: 'problem',
    docs: { description: 'forbid dictionary types whose value type is an escape hatch' },
    messages: { unsafeDictionary: MESSAGE },
  },
  create(context) {
    let environment = EMPTY_TYPE_ENVIRONMENT

    const report = (node: ESTree.Node, unsafeValue: UnsafeValue | undefined) => {
      if (unsafeValue !== undefined) {
        context.report({ node, messageId: 'unsafeDictionary', data: { value: unsafeValue } })
      }
    }

    const reportUnsafeType = (
      node: ESTree.TSTypeReference | ESTree.TSTypeLiteral | ESTree.TSMappedType,
    ) => {
      report(node, unsafeTypeValue(node, environment))
    }

    return {
      Program(node) {
        environment = createTypeEnvironment(node)
      },
      TSTypeReference: reportUnsafeType,
      TSTypeLiteral: reportUnsafeType,
      TSMappedType: reportUnsafeType,
      TSIndexSignature(node) {
        report(node, unsafeIndexSignatureValue(node, environment))
      },
    }
  },
})
