import type { Commands } from './commands.ts'
type Command = () => void
type IndexOf<Value> = Record<string, Value>
type CommandShape = { readonly start: Command }
type Permission = 'admin'
type PermissionLevels = { readonly [Level in Permission]: number }
type Readonly<Value> = { readonly value: Value }
interface CommandMap { readonly start: Command }
declare function make(): Record<string, Command>
declare const external: Command
const startCommand = () => {}
const accumulator: Record<string, Command> = {}
const genericAccumulator: IndexOf<Command> = {}
const inferred = { start: startCommand }
const frozen = { start: startCommand } as const
const satisfied = { start: startCommand } satisfies Record<string, Command>
const both = { start: startCommand } as const satisfies Commands
const fromInterface: CommandMap = { start: startCommand }
const fromAlias: CommandShape = { start: startCommand }
const fromImport: Commands = { start: startCommand }
const levels: PermissionLevels = { admin: 1 }
const shadowedWrapper: Readonly<Record<string, Command>> = { value: startCommand }
const fromCall: Record<string, Command> = make()
const fromDeclare: Record<string, Command> = external
const emptyAssertion = {} as Record<string, Command>
const emptyBracketed = <Record<string, Command>>{}
const assertedNamed = {} as CommandMap
let mutableSource = { start: startCommand }
mutableSource = { start: startCommand }
const fromMutable: Record<string, Command> = mutableSource
let lateAccumulator: Record<string, Command>
lateAccumulator = {}
function createInferred() { return { start: startCommand } }
function createNamed(): CommandMap { return { start: startCommand } }
function createAccumulator(): Record<string, Command> { return {} }
const createArrow = (): Record<string, Command> => ({})
class Registry { commands: Record<string, Command> = {} }
class Accessors { accessor commands: Record<string, Command> = {} }
