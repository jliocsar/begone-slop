import { type Array, Effect } from 'effect'

const typeOnlyImportLeavesTheGlobal = Array.isArray(values)
const typeOnlyImportLeavesFrom = Array.from(values)
