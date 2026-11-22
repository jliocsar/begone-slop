import { setTimeout as sleep } from 'node:timers/promises'
import { setTimeout as delay } from './helpers'
await sleep(100)
async function waitForBoot() { await sleep(100) }
test('awaits the operation', async () => { await server.ready() })
test('awaits a helper of the same name', async () => { await delay(100) })
test('shadows setTimeout', async () => { const setTimeout = (run: () => void) => run(); await new Promise((resolve) => setTimeout(resolve, 100)) })
describe('a suite', () => { test('fires a timer without waiting', () => { setTimeout(() => undefined, 100) }) })
test('waits on an event', async () => { await new Promise((resolve) => emitter.once('ready', resolve)) })
function pause(milliseconds: number) { return Bun.sleep(milliseconds) }
test('has a Bun of its own', async () => { const Bun = { sleep: async () => undefined }; await Bun.sleep() })
