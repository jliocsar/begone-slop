function positional(input: unknown) {}
const arrow = (input: unknown) => input
const expression = function (input: unknown) {}
class Constructed { constructor(private readonly input: unknown) {} }
function rested(...inputs: unknown) {}
function defaulted(input: unknown = 1) {}
function destructured({ nested }: unknown) {}
declare function declared(input: unknown): void
abstract class Abstracted { abstract method(input: unknown): void }
type CallSignature = (input: unknown) => void
type ConstructorSignature = new (input: unknown) => void
interface Methods { method(input: unknown): void }
interface Calls { (input: unknown): void }
interface Constructs { new (input: unknown): void }
