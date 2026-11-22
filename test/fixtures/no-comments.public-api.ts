/** Reads the profile the caller is signed in as. */
export function currentProfile() { return profile }
/** Not exported, so still a comment. */
function helper() { return 1 }
/** Exported through a list further down. */
const listed = helper()
export { listed }
/** @internal kept off the public surface */
export const hidden = 1
// a line comment above an export is not TSDoc
export const plain = 2
/** A documented class. */
export class Session {
  /** A public member. */
  open() {}
  /** A private member is not public API. */
  private close() {}
}
/** A documented interface. */
export interface Options {
  /** A documented field. */
  readonly retries: number
}
export function run() {
  /** Inside a function body, still a comment. */
  return 1
}
/** A documented enum. */
export enum Mode {
  /** A documented member. */
  Fast,
}
/** A documented object type. */
export type Settings = {
  /** A documented field. */
  readonly verbose: boolean
}
