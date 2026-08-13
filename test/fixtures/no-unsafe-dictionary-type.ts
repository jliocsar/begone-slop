type UnknownDictionary = Record<string, unknown>
type AnyDictionary = Record<string, any>
type ObjectDictionary = Record<string, object>
type EmptyDictionary = Record<string, {}>
type BrandedDictionary = Record<string, { readonly brand?: never }>
type UnionDictionary = Record<string, string | unknown>
type IntersectionDictionary = Record<string, unknown & object>
type MarkerDictionary = Record<string, Marker>
type LiteralDictionary = { [key: string]: unknown }
type MappedDictionary = { [Key in string]: unknown }
type WrappedDictionary = Readonly<Record<string, unknown>>
type PickedDictionary = Pick<UnknownDictionary, string>
type AppliedGeneric = GenericDictionary<unknown>
interface UnknownRegistry { [key: string]: unknown }
interface Marker {}
type GenericDictionary<Value> = Record<string, Value>
declare const consumer: UnknownDictionary
