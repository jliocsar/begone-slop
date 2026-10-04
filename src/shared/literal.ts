import type { ESTree } from '@oxlint/plugins'

export function stringLiteralValue(node: ESTree.Node): string | undefined {
  if (node.type !== 'Literal') {
    return undefined
  }

  const { value } = node

  // oxlint-disable-next-line begone-slop/no-runtime-typeof -- ESTree literals carry no kind tag; the value's runtime type is the discriminant
  return typeof value === 'string' ? value : undefined
}
