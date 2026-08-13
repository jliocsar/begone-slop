import * as Effect from 'effect/Effect'
import * as Option from 'effect/Option'
import * as Ref from 'effect/Ref'
import { Diagnostic, type ESTree, Rule, RuleContext } from 'effect-oxlint'
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

function unsafeDiagnostic(node: ESTree.Node, unsafeValue: UnsafeValue): Diagnostic.Diagnostic {
  return Diagnostic.fromId({
    node,
    messageId: 'unsafeDictionary',
    data: { value: unsafeValue },
  })
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

  return typeReferenceName(node).pipe(
    Option.exists((name) => environment.aliases.has(name) && !isInsideTypeAliasDeclaration(node)),
  )
}

function hasUnsafeTypeAncestor(node: ESTree.Node, environment: TypeEnvironment): boolean {
  const { parent } = node

  if (parent === null || parent.type === 'Program') {
    return false
  }

  if (isTypeNode(parent) && Option.isSome(classifyUnsafeDictionary(parent, environment))) {
    return true
  }

  return hasUnsafeTypeAncestor(parent, environment)
}

function unsafeTypeDiagnostic(
  node: ESTree.Node,
  environment: TypeEnvironment,
): Option.Option<Diagnostic.Diagnostic> {
  if (!isTypeNode(node) || isPlainAliasConsumerUse(node, environment)) {
    return Option.none()
  }

  return classifyUnsafeDictionary(node, environment).pipe(
    Option.filter(() => !hasUnsafeTypeAncestor(node, environment)),
    Option.map((unsafe) => unsafeDiagnostic(node, unsafe.unsafeValue)),
  )
}

function unsafeIndexSignatureDiagnostic(
  node: ESTree.Node,
  environment: TypeEnvironment,
): Option.Option<Diagnostic.Diagnostic> {
  if (node.type !== 'TSIndexSignature' || node.parent.type === 'TSTypeLiteral') {
    return Option.none()
  }

  return classifyUnsafeDictionaryValue(node.typeAnnotation.typeAnnotation, environment).pipe(
    Option.map((unsafe) => unsafeDiagnostic(node, unsafe.unsafeValue)),
  )
}

export default Rule.define({
  name: 'no-unsafe-dictionary-type',
  meta: Rule.meta({
    type: 'problem',
    description: 'forbid dictionary types whose value type is an escape hatch',
    messages: { unsafeDictionary: MESSAGE },
  }),
  create: function* () {
    const context = yield* RuleContext
    const environment = yield* Ref.make(EMPTY_TYPE_ENVIRONMENT)

    const report =
      (
        diagnose: (
          node: ESTree.Node,
          known: TypeEnvironment,
        ) => Option.Option<Diagnostic.Diagnostic>,
      ) =>
      (node: ESTree.Node) =>
        Ref.get(environment).pipe(
          Effect.flatMap((known) =>
            Option.match(diagnose(node, known), {
              onNone: () => Effect.void,
              onSome: context.report,
            }),
          ),
        )

    const reportUnsafeType = report(unsafeTypeDiagnostic)

    return {
      Program: (node: ESTree.Node) => Ref.set(environment, createTypeEnvironment(node)),
      TSTypeReference: reportUnsafeType,
      TSTypeLiteral: reportUnsafeType,
      TSMappedType: reportUnsafeType,
      TSIndexSignature: report(unsafeIndexSignatureDiagnostic),
    }
  },
})
