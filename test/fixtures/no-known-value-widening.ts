type Command = () => void
const startCommand = () => {}
const knownSource = { start: startCommand }
type OpenIndex = Record<string, Command>
type IndexOf<Value> = Record<string, Value>
const widenedToUnknown: unknown = {}
const widenedToObject: object = []
const widenedLiteral: unknown = 1
const commands: Record<string, Command> = { start: startCommand }
const indexed: { [key: string]: Command } = { start: startCommand }
const mapped: { [Key in string]: Command } = { start: startCommand }
const shaped: { start: Command } = { start: startCommand }
const aliased: OpenIndex = knownSource
const applied: IndexOf<Command> = { start: startCommand }
const asserted = { start: startCommand } as Record<string, Command>
const bracketed = <Record<string, Command>>{ start: startCommand }
let assignedLater: unknown
assignedLater = { start: startCommand }
function makeUnknown(): unknown { return {} }
function makeCommands(): Record<string, Command> { return { start: startCommand } }
const makeArrow = (): Record<string, Command> => ({ start: startCommand })
class Registry { commands: Record<string, Command> = { start: startCommand } }
class Accessors { accessor commands: Record<string, Command> = { start: startCommand } }
const chained = { start: startCommand } as Record<string, Command> as object
