import * as Arr from 'effect/Array'
import * as Option from 'effect/Option'

const first = 1
const second = 2

function compute(value: number): number {
  const doubled = value * 2

  if (doubled > 10) {
    return doubled
  }

  return value
}

class Holder {}

const afterClass = compute(1)
