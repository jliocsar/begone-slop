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
/* v8 ignore next */
const theta = /*#__PURE__*/ readValue()
const iota = /* @__PURE__ */ readValue()
/* #__NO_SIDE_EFFECTS__ */
const kappa = () => readValue()
// prettier-ignore
const lambda = [1,0,0,1]
// biome-ignore lint/suspicious/noExplicitAny: legacy
const mu = [theta, iota, kappa, lambda]
/**
 * SAFETY: the parser checked the shape above
 */
const nu = mu as unknown[]
/** @jsxImportSource preact */
/* @jsx h */
/* @jsxFrag Fragment */
/* @jsxRuntime classic */
// @vitest-environment jsdom
/* @jest-environment node */
//# sourceMappingURL=no-comments.js.map
