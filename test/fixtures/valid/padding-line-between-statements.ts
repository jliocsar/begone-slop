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
