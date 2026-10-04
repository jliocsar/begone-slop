import { Option } from 'effect'
import * as Result from 'effect/Result'

const alreadyIdiomatic = Option.fromNullable(value)

// The `some` arm must wrap the tested value itself, not something derived from it.
const derivedValue = value !== null ? Option.some(decode(value)) : Option.none()
const derivedMember = user != null ? Option.some(user.name) : Option.none()
const otherValue = value !== null ? Option.some(other) : Option.none()
const calledTwice = next() !== null ? Option.some(next()) : Option.none()
const againstZero = value !== 0 ? Option.some(value) : Option.none()

// `Option.none` without a call is a value, not the constructor call.
const bareNone = value !== null ? Option.some(value) : Option.none
const bareSome = value !== null ? Option.some : Option.none()

// Receivers that are not an import of Option.
const aliased = value !== null ? O.some(value) : O.none()
const namespaced = value !== null ? Effect.Option.some(value) : Effect.Option.none()

// The arms must follow the test's direction, come from `Option`, and be nothing else.
const swappedArms = value !== null ? Option.none() : Option.some(value)
const bothSome = value !== null ? Option.some(value) : Option.some(fallback)
const otherMethod = value !== null ? Option.some(value) : Option.getOrNull(other)
const otherModule = value !== null ? Result.some(value) : Result.none()
const plainTernary = value !== null ? value : null

// A nullable test elsewhere in the ternary is not the pattern.
const nestedTest = (value !== null) === flag ? Option.some(value) : Option.none()
const nullishCoalesced = (value ?? fallback) ? Option.some(value) : Option.none()
const shadowed = (Option: Maybe) => (value !== null ? Option.some(value) : Option.none())
const otherNamespace = value !== null ? Result.some(value) : Option.none()
