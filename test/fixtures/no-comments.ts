// a line comment narrating the binding below
/* a block comment saying the same thing twice */
/** a jsdoc comment describing an obvious parameter */
// ts-expect-error without the leading at-sign is prose, not a directive
// eslint disable-next-line spells the directive with a space
/* c8ignore next, missing the space the directive needs */
// istanbul-ignore next, hyphenated where the directive uses a space
// <reference lacks the leading slash the directive is anchored on
/* oxlint disable, a space where the directive has a hyphen */
const total = 1 // a trailing comment on a line of code
// the invariant is SAFETY: adjacent, and the carve-out is anchored at the start
const later = total as number /* see SAFETY: the marker must open the comment */
/** @jsxImportSourcery is not the pragma */
// WARNING: off by default, so this is still prose
/** Exported TSDoc stays a comment unless publicApi names this file. */
export const documented = total
// nosemgreps without the directive's boundary are prose
/* webpack is a bundler, and this is a sentence about it */
// @licensed under protest is not a licence header
/*! a preserved banner with nothing but prose in it */
