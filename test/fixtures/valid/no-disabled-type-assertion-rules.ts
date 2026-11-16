// SAFETY: the parser checked it
const checked = input as Checked
// oxlint-disable-next-line begone-slop/no-runtime-typeof -- the runtime type is the tag
const tagged = typeof input
const logged = input // eslint-disable-line no-console
/* oxlint-disable no-console */
// This sentence mentions oxlint-disable-next-line typescript/no-unsafe-type-assertion in prose.
// oxlint-disable-next-line local/no-type-assertion
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loose = input
