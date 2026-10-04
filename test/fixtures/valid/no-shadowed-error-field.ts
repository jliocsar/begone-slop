// `message` and `cause` keep Error's own meaning, so they are legal fields.
class Missing extends Schema.TaggedErrorClass<Missing>()('Missing', {
  message: Schema.String,
  cause: Schema.Defect,
}) {}

// Named for what it holds, not for where it sits.
class Named extends Schema.TaggedErrorClass<Named>()('Named', {
  userName: Schema.String,
  commandStack: Schema.String,
}) {}

class Untagged extends Schema.ErrorClass<Untagged>('Untagged')({
  agentName: Schema.String,
}) {}

// Not a curried error-class factory: a plain schema may hold any field name.
const Row = Schema.Struct({ name: Schema.String, stack: Schema.String })

class Model extends Schema.Class<Model>('Model')({ name: Schema.String }) {}

// A getter is a method on the class body, not a schema field.
class Reported extends Schema.TaggedErrorClass<Reported>()('Reported', {
  userName: Schema.String,
}) {
  get message() {
    return `No user named ${this.userName}. Pass one that exists.`
  }
}

class DataNamed extends Data.TaggedError('DataNamed')<{ readonly userName: string; readonly message: string }> {}
class NotAnError extends Data.Class<{ readonly name: string }> {}
class TaggedData extends Data.TaggedClass('TaggedData')<{ readonly name: string }> {}
class PlainStruct extends Schema.Class<PlainStruct>('PlainStruct')(Schema.Struct({ name: Schema.String })) {}
class StructNamed extends Schema.ErrorClass<StructNamed>('StructNamed')(Schema.Struct({ userName: Schema.String })) {}
