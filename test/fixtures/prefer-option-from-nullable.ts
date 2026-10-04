const byStrictTest = value !== null ? Option.some(value) : Option.none()
const byLooseTest = value != null ? Option.some(value) : Option.none()
const byNullOnTheLeft = null !== value ? Option.some(value) : Option.none()
const byTypeArguments = value !== null ? Option.some<number>(value) : Option.none<number>()
const byInstantiationCallee = value !== null ? Option.some(value) : (Option.none<number>)()
const byMemberSubject = user.name !== null ? Option.some(user.name) : Option.none()
const invertedStrict = value === null ? Option.none() : Option.some(value)
const invertedLoose = value == null ? Option.none() : Option.some(value)
const againstUndefined = value !== undefined ? Option.some(value) : Option.none()
const invertedUndefinedOnTheLeft = undefined === value ? Option.none() : Option.some(value)
const looseUndefined = value != undefined ? Option.some(value) : Option.none()
const thisMember = this.user !== null ? Option.some(this.user) : Option.none()
import { Option } from 'effect'
import { Option as Maybe } from 'effect'
import * as O from 'effect/Option'
const renamedBarrel = value !== null ? Maybe.some(value) : Maybe.none()
const renamedNamespace = value !== null ? O.some(value) : O.none()
const mixedBindings = value === null ? Option.none() : O.some(value)
const computed = value !== null ? Option['some'](value) : Option['none']()
