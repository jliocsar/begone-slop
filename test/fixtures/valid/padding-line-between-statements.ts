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

export const firstExport = 1
export const secondExport = 2

export const handler = () => {
  compute(2)
}

export function run(): void {}

export class Runner {}

export default function main(): void {}

export function parse(input: string): number
export function parse(input: number): number
export function parse(input: string | number): number {
  return Number(input)
}

function local(input: string): string
function local(input: number): number
function local(input: string | number): string | number {
  return input
}

export default function (input: string): string
export default function (input: number): number
export default function (input: string | number): string | number {
  return input
}

@sealed
export class Decorated {}

namespace Tools {
  const inside = 1

  if (inside) {
    compute(inside)
  }
}

declare global {
  const ambient: number

  function helper(): void
}

exports.value = 1
exports.other = 2

exports.handler = async (event: string) => {
  return event
}

outer: for (const item of [first, second]) {
  continue outer
}

const afterLabel = 1

import fs = require('fs')

const afterImportEquals = 1

const Shape = class {
  area() {}
}

const afterClassExpression = 1

const GROUPED_FIRST = 1
const GROUPED_SECOND = 2

export const EXPORTED_FIRST = 1
export const EXPORTED_SECOND = 2

export const notScreaming = () => EXPORTED_FIRST

export const spacedCamel = 1

export const ANOTHER_GROUP = 3
// A comment between grouped constants is left alone.

export const AFTER_COMMENT = 4

function localsKeepTheirSpacing(): number {
  const first = 1

  const second = 2

  return first + second
}
