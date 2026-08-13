#!/usr/bin/env bun
/// <reference types="bun" />
// @ts-expect-error the upstream types disagree with what the runtime returns
const alpha = readValue()
// eslint-disable-next-line no-console
console.log(alpha)
// oxlint-disable-next-line begone-slop/no-unknown-parameters -- walks arbitrary AST fields; oxlint's node types do not model them
const beta = readValue()
/* c8 ignore next */
const gamma = readValue()
// istanbul ignore next
const delta = readValue()
// SAFETY: the schema validated this field before it reached here
const epsilon = alpha as string
const zeta = /* SAFETY: the caller checked the discriminant */ beta as string
/* @ts-nocheck-style directive in block form */
const eta = [gamma, delta, epsilon, zeta]
