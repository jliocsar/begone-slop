const alreadyIdiomatic = Option.fromNullable(value)

// The inverted form is not flagged: the arms are the other way round.
const inverted = value === null ? Option.none() : Option.some(value)
const invertedLoose = value == null ? Option.none() : Option.some(value)

// `undefined` is a different test from `null`.
const againstUndefined = value !== undefined ? Option.some(value) : Option.none()
const againstZero = value !== 0 ? Option.some(value) : Option.none()

// `Option.none` without a call is a value, not the constructor call.
const bareNone = value !== null ? Option.some(value) : Option.none
const bareSome = value !== null ? Option.some : Option.none()

// Aliased imports are out of reach of a purely syntactic check.
const aliased = value !== null ? O.some(value) : O.none()
const namespaced = value !== null ? Effect.Option.some(value) : Effect.Option.none()

// The arms must be `some` then `none`, from `Option`, and nothing else.
const swappedArms = value !== null ? Option.none() : Option.some(value)
const bothSome = value !== null ? Option.some(value) : Option.some(fallback)
const otherMethod = value !== null ? Option.some(value) : Option.getOrNull(other)
const otherModule = value !== null ? Result.some(value) : Result.none()
const plainTernary = value !== null ? value : null

// A nullable test elsewhere in the ternary is not the pattern.
const nestedTest = (value !== null) === flag ? Option.some(value) : Option.none()
const nullishCoalesced = (value ?? fallback) ? Option.some(value) : Option.none()
