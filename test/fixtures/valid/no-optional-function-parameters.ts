function withADefault(first = 1) { return first }
const arrow = (second: string | undefined) => second
const expression = function (third: number | null) { return third }
class Holder { method(fourth: { readonly fifth?: string }) { return fourth.fifth } }
class Constructed { constructor(private readonly sixth: string) {} }
interface Contract { method(seventh?: string): void }
type Signature = (eighth?: number) => void
declare function declared(ninth?: string): void
