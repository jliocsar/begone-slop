export function isNodeOfType<
  Node extends { readonly type: string },
  const Type extends Node['type'],
>(node: Node, types: readonly Type[]): node is Node & { readonly type: Type } {
  return types.some((type) => type === node.type)
}
