import * as Arr from 'effect/Array'
import * as Option from 'effect/Option'

interface Measured {
  readonly size: number
}

type Label = string

const LIMIT = 10

const SPEC = { size: LIMIT }

type Spec = typeof SPEC

type Size = (typeof SPEC)['size']

const DERIVED: Spec = { size: SPEC.size }

class Holder {}

function measure(shape: Measured): number {
  return shape.size
}

let counter = 0

declare module 'some-module' {
  const value: number
}

export { LIMIT, measure }
export default measure
