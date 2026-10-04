// A single ternary is a ternary, not a hand-rolled match.
const single = value === 'ready' ? 1 : 2

// Different subjects: the chain is not one match, and this is the near-miss the
// rule most plausibly gets wrong.
const twoSubjects = first === 'ready' ? 1 : second === 'ready' ? 2 : 3
const twoProperties = record.left === 1 ? 'a' : record.right === 1 ? 'b' : 'c'

// One link out of three disagrees, so the whole chain is left alone rather than
// reported down to its matching prefix.
const prefixOnly = tier === 'a' ? 1 : tier === 'b' ? 2 : other === 'c' ? 3 : 4

// No literal on either side.
const noLiteral = left === right ? 1 : left === middle ? 2 : 3

// A template literal with an interpolation is not a literal.
const interpolated = value === `${prefix}-ready` ? 1 : value === `${prefix}-failed` ? 2 : 3

// Not an equality operator.
const ordered = count > 1 ? 'a' : count > 2 ? 'b' : 'c'
const logical = value === 'ready' && ok ? 1 : value === 'failed' && ok ? 2 : 3

// Tests that are not comparisons at all.
const truthy = ready ? 1 : failed ? 2 : 3

// Literals on both sides: the right-hand text is what has to repeat, and here
// it does not.
const bothLiterals = 'ready' === 'failed' ? 1 : 'ready' === 'other' ? 2 : 3

// Nested through the consequent, not the alternate.
const throughConsequent = value === 'ready' ? (value === 'warm' ? 1 : 2) : 3

// One literal check followed by a plain condition.
const mixedTail = value === 'ready' ? 1 : ready ? 2 : 3

// Each call, construction, await, yield or update reads a fresh value, so the
// repeated text is not one subject.
const called = classify(input) === 1 ? 'a' : classify(input) === 2 ? 'b' : 'c'
const sideEffect = next() === 'a' ? 1 : next() === 'b' ? 2 : 3
const constructed = new Clock().tick === 1 ? 'a' : new Clock().tick === 2 ? 'b' : 'c'
const incremented = counter++ === 1 ? 'a' : counter++ === 2 ? 'b' : 'c'
const assigned = (slot = read()) === 1 ? 'a' : (slot = read()) === 2 ? 'b' : 'c'
const tagged = tag`x` === 1 ? 'a' : tag`x` === 2 ? 'b' : 'c'
const indexedByCall = record[next()] === 1 ? 'a' : record[next()] === 2 ? 'b' : 'c'
async function awaited() {
  return (await read()) === 1 ? 'a' : (await read()) === 2 ? 'b' : 'c'
}
function* yielded() {
  return (yield) === 1 ? 'a' : (yield) === 2 ? 'b' : 'c'
}
