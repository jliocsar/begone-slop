const before = 1
if (before) {
  work()
}
const after = 2

export const firstExport = 1
export const secondExport = 2
export const handler = () => {
  work()
}
export function run() {}
export class Runner {}
export default function main() {}

function overloaded(input: string): string
function overloaded(input: number): number
function overloaded(input: string | number): string | number {
  return input
}
function unrelated() {}

const decoratedBefore = 2
@sealed
export class Decorated {}

const overloadedBefore = 1
function fenced(input: string): string
function fenced(input: number): number
function fenced(input: string | number): string | number {
  return input
}

const defaultBefore = 1
@sealed
export default class {}

namespace Tools {
  const inside = 1
  if (inside) {
    work()
  }
}

declare global {
  const ambient: number
  function helper(): void
}

const prefix = 'x'
exports.handler = async (event: string) => {
  return prefix + event
}
const afterAssignment = 1

outer: for (const item of items) {
  continue outer
}
const afterLabel = 1

import fs = require('fs')
const afterImportEquals = 1

const Shape = class {
  area() {}
}
const afterClassExpression = 1

declare module 'virtual' {
  const declared: number
  function load(): void
}

const PRIVATE_FIRST = 1

const PRIVATE_SECOND = 2
export const PUBLIC_FIRST = 1
export const PUBLIC_SECOND = 2

export const PUBLIC_THIRD = 3
export const afterConstants = () => PUBLIC_THIRD
export const AFTER_CAMEL = 4

function localGroup(): number {
  const LIMIT = 1

  const MARGIN = 2
  const total = LIMIT + MARGIN

  return total
}
