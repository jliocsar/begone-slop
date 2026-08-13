import * as Readonly from 'effect/Struct'

type Command = { readonly name: string }

type JsonValue = string | number | boolean | null

type Outcome<Value, Failure> = { readonly value: Value; readonly failure: Failure }

interface Partial {
  readonly done: boolean
}

interface Merged {}

interface Merged {}

interface Extended extends Command {}

interface CommandRegistry {
  [key: string]: Command
}

type CommandsByName = Record<string, Command>
type JsonByKey = Record<PropertyKey, JsonValue>
type NestedUnknown = Record<string, { payload: unknown }>
type OutcomesByName = Record<string, Outcome<Command, unknown>>
type NarrowedIntersection = Record<string, unknown & Command>
type MergedValues = Record<string, Merged>
type ExtendedValues = Record<string, Extended>
type NamedShape = { readonly start: Command }
type CommandLiteral = { [key: string]: Command }
type CommandMapping = { [Key in string]: Command }
type GenericDictionary<Value> = Record<string, Value>
type CommandDictionary = GenericDictionary<Command>
type CommandCache = Map<string, unknown>
type ReadonlyCommandCache = ReadonlyMap<string, unknown>
type CommandWeakCache = WeakMap<object, unknown>
type ShadowedWrapper = { [key: string]: Readonly<unknown> }
type ShadowedInterface = { [key: string]: Partial<unknown> }
