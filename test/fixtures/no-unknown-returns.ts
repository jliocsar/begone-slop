function direct(): unknown { return 1 }
const arrow = (): unknown => 1
const expression = function (): unknown { return 1 }
function unioned(): string | unknown { return 'a' }
async function promised(): Promise<unknown> { return 1 }
function promiseLike(): PromiseLike<unknown> { return Promise.resolve(1) }
function aliased(): Aliased { return 1 }
function exported(): Exported { return 1 }
function chained(): Chained { return 1 }
declare function declared(): unknown
abstract class Abstracted { abstract method(): unknown }
type CallSignature = () => unknown
type ConstructorSignature = new () => unknown
interface Methods { method(): unknown }
interface Calls { (): unknown }
interface Constructs { new (): unknown }
type Aliased = unknown
export type Exported = unknown
type Chained = Aliased
