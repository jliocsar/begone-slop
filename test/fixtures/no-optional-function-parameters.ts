function declared(first?: number) { return first }
const arrow = (second?: string) => second
const expression = function (third?: boolean) { return third }
class Holder { method(fourth?: number) { return fourth } }
class Constructed { constructor(private readonly fifth?: string) {} }
function pair(sixth?: number, seventh?: number) { return sixth ?? seventh }
