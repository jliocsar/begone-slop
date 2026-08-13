/**
 * A dictionary keyed by anything and valued by an escape hatch (`unknown`,
 * `any`, `object`, `{}`, or a union or alias resolving to one) is a bag: every
 * read has to re-establish what came out. Give the value type an owner — a
 * schema-derived type — and parse external payloads before insertion.
 *
 * Only the DIRECT value type counts. `Record<string, { payload: unknown }>` has
 * a concrete value contract with a weak field, which is a different complaint.
 * An intersection keeps its concrete members (`unknown & Owner` is fine), and a
 * built-in the file declares or imports is not the built-in any more.
 *
 * One report per outermost offender: a nested unsafe type inside another one is
 * the same defect, and a bare use of a local alias is reported at the alias.
 *
 * Report-only — the value type is the author's domain knowledge.
 */

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
} from '../shared/type-environment.ts'

/**
 * Every node type that is a written type, listed rather than inferred: the
 * ancestor walk climbs through non-type nodes (a `TSTypeParameterInstantiation`
 * sits between a reference and its argument) and must only skip a report when a
 * TYPE ancestor already covers it.
 */
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

const VALUE_PLACEHOLDER = '{{value}}'

const MESSAGE_TEMPLATE = `This dictionary's ${VALUE_PLACEHOLDER} value type gives callers no concrete value contract. Use an owner/schema-derived value type; parse external payloads before insertion.`

function isTypeNode(node: ESTree.Node): node is ESTree.TSType {
  return TYPE_NODE_KINDS.has(node.type)
}

function unsafeDiagnostic(node: ESTree.Node, unsafeValue: UnsafeValue): Diagnostic.Diagnostic {
  return Diagnostic.make({
    node,
    message: MESSAGE_TEMPLATE.replace(VALUE_PLACEHOLDER, unsafeValue),
  })
}

function isInsideTypeAliasDeclaration(node: ESTree.Node): boolean {
  const { parent } = node

  if (parent === null || parent.type === 'Program') {
    return false
  }

  return parent.type === 'TSTypeAliasDeclaration' || isInsideTypeAliasDeclaration(parent)
}

/**
 * `const registry: Unsafe = {}` names an alias declared in this file, and the
 * declaration is already reported. Inside another alias the reference is part
 * of a new contract, so it stands on its own.
 */
function isPlainAliasConsumerUse(node: ESTree.TSType, environment: TypeEnvironment): boolean {
  if (node.type !== 'TSTypeReference' || (node.typeArguments?.params.length ?? 0) > 0) {
    return false
  }

  return typeReferenceName(node).pipe(
    Option.exists((name) => environment.aliases.has(name) && !isInsideTypeAliasDeclaration(node)),
  )
}

function typeReferenceName(type: ESTree.TSTypeReference): Option.Option<string> {
  return type.typeName.type === 'Identifier' ? Option.some(type.typeName.name) : Option.none()
}

/** True when some enclosing WRITTEN type is unsafe for the same reason. */
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

/**
 * An index signature in an INTERFACE body: the interface itself is never
 * visited as a type, so its value type is classified here. Inside a type
 * literal the literal already carries the report.
 */
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
  }),
  create: function* () {
    const context = yield* RuleContext
    // Built once per file, so a type written above its alias resolves too.
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
