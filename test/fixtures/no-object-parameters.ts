function positional(input: object) {}
const arrow = (input: object) => input
const expression = function (input: object) {}
class Constructed { constructor(private readonly input: object) {} }
function rested(...inputs: object) {}
function defaulted(input: object = {}) {}
function destructured({ nested }: object) {}
declare function declared(input: object): void
abstract class Abstracted { abstract method(input: object): void }
type CallSignature = (input: object) => void
type ConstructorSignature = new (input: object) => void
interface Methods { method(input: object): void }
interface Calls { (input: object): void }
interface Constructs { new (input: object): void }
function unioned(input: string | object) {}
type Alias = object
function aliased(input: Alias) {}
type Indirect = Alias
function indirect(input: Indirect) {}
export function exported(first: object, second: Alias) {}
