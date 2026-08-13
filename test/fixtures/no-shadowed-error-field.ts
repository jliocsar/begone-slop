class Bad extends Schema.TaggedErrorClass<Bad>()('Bad', { name: UserNameSchema }) {}
class AlsoBad extends Schema.ErrorClass<AlsoBad>('AlsoBad')({ stack: Schema.String }) {}
