import type { ESTree, SourceCode } from '@oxlint/plugins'
import { findVariable, isConstDeclarator, variableDeclarator } from './binding-scope.ts'
import { effectModuleMemberName } from './effect-module-import.ts'
import { staticKeyName } from './literal.ts'
import { optionProperty, serviceOptions, staticMember } from './service-class.ts'
import { unwrapTransparentExpression } from './transparent-expression.ts'

export type ServiceOperation = {
  readonly property: ESTree.ObjectProperty
  readonly name: string
  readonly value: ESTree.Node
}

const EFFECT_MODULE = 'Effect'
const GEN = 'gen'
const MAKE = 'make'
const PIPE = 'pipe'

function constInitializer(sourceCode: SourceCode, node: ESTree.Node): ESTree.Node | undefined {
  if (node.type !== 'Identifier') {
    return undefined
  }

  const variable = findVariable(sourceCode.getScope(node), node.name)
  const declarator = variable === undefined ? undefined : variableDeclarator(variable)

  if (declarator === undefined || !isConstDeclarator(declarator)) {
    return undefined
  }

  return declarator.init ?? undefined
}

function resolved(sourceCode: SourceCode, node: ESTree.Node): ESTree.Node {
  const expression = unwrapTransparentExpression(node)
  const initializer = constInitializer(sourceCode, expression)

  return initializer === undefined ? expression : unwrapTransparentExpression(initializer)
}

function topLevelReturns(body: ESTree.FunctionBody | null | undefined): readonly ESTree.Node[] {
  return (body?.body ?? []).flatMap((statement) =>
    statement.type === 'ReturnStatement' && statement.argument !== null ? [statement.argument] : [],
  )
}

export function returnedExpressions(
  owner: ESTree.ArrowFunctionExpression | ESTree.Function,
): readonly ESTree.Node[] {
  if (owner.type === 'ArrowFunctionExpression' && owner.expression) {
    return [owner.body]
  }

  return owner.body?.type === 'BlockStatement' ? topLevelReturns(owner.body) : []
}

function pipeReceiver(node: ESTree.Node): ESTree.Node | undefined {
  if (node.type !== 'CallExpression' || node.callee.type !== 'MemberExpression') {
    return undefined
  }

  return staticKeyName(node.callee.property, node.callee.computed) === PIPE
    ? unwrapTransparentExpression(node.callee.object)
    : undefined
}

function withoutPipes(node: ESTree.Node): ESTree.Node {
  const receiver = pipeReceiver(node)

  return receiver === undefined ? node : withoutPipes(receiver)
}

function makeGenerator(sourceCode: SourceCode, make: ESTree.Node): ESTree.Function | undefined {
  const value = unwrapTransparentExpression(make)
  const [returned] =
    value.type === 'ArrowFunctionExpression' || value.type === 'FunctionExpression'
      ? returnedExpressions(value)
      : [value]
  const effect =
    returned === undefined ? undefined : withoutPipes(unwrapTransparentExpression(returned))

  if (
    effect?.type !== 'CallExpression' ||
    effectModuleMemberName(sourceCode, effect.callee, EFFECT_MODULE) !== GEN
  ) {
    return undefined
  }

  const generator = effect.arguments.at(-1)

  return generator?.type === 'FunctionExpression' && generator.generator ? generator : undefined
}

function serviceMakes(service: ESTree.Class): readonly ESTree.Node[] {
  const fromOptions = optionProperty(serviceOptions(service), MAKE)
  const fromStatic = staticMember(service, MAKE)?.value ?? undefined

  return [fromOptions, fromStatic].flatMap((make) => (make === undefined ? [] : [make]))
}

function returnedObjects(
  sourceCode: SourceCode,
  generator: ESTree.Function,
): readonly ESTree.ObjectExpression[] {
  return returnedExpressions(generator).flatMap((returned) => {
    const object = resolved(sourceCode, returned)

    return object.type === 'ObjectExpression' ? [object] : []
  })
}

export function serviceOperations(
  sourceCode: SourceCode,
  service: ESTree.Class,
): readonly ServiceOperation[] {
  return serviceMakes(service)
    .flatMap((make) => {
      const generator = makeGenerator(sourceCode, make)

      return generator === undefined ? [] : returnedObjects(sourceCode, generator)
    })
    .flatMap((object) => object.properties)
    .flatMap((property) => {
      const name =
        property.type === 'Property' ? staticKeyName(property.key, property.computed) : undefined

      return property.type === 'Property' && name !== undefined
        ? [{ property, name, value: resolved(sourceCode, property.value) }]
        : []
    })
}
