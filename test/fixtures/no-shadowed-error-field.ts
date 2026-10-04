class Bad extends Schema.TaggedErrorClass<Bad>()('Bad', { name: UserNameSchema }) {}
class AlsoBad extends Schema.ErrorClass<AlsoBad>('AlsoBad')({ stack: Schema.String }) {}
class DataTagged extends Data.TaggedError('DataTagged')<{ readonly name: string }> {}
class DataUntagged extends Data.Error<{ readonly stack: string }> {}
class StructFields extends Schema.TaggedErrorClass<StructFields>()('StructFields', Schema.Struct({ name: Schema.String })) {}
class QuotedTypeKey extends Data.TaggedError('QuotedTypeKey')<{ readonly 'stack': string; readonly code: number }> {}
const DataExpression = class extends Data.Error<{ name: string }> {}
