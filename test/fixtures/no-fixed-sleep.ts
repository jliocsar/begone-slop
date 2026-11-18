import { setTimeout as sleep } from 'node:timers/promises'
import * as timers from 'timers/promises'
import { scheduler } from 'node:timers/promises'
test('waits on a promise timer', async () => { await sleep(100) })
it('waits on a namespace timer', async () => { await timers.setTimeout(100) })
beforeEach(async () => { await scheduler.wait(100) })
afterEach(async function () { await Bun.sleep(100) })
test('wraps setTimeout in a promise', async () => { await new Promise((resolve) => setTimeout(resolve, 100)) })
test('wraps it in a block', async () => { await new Promise((resolve) => { setTimeout(resolve, 100) }) })
test('resolves from a callback', async () => { await new Promise((done) => globalThis.setTimeout(() => done(), 100)) })
test.each([1, 2])('runs a table', async () => { await sleep(100) })
it.only('is focused', async () => { await sleep(100) })
beforeAll(async () => { await timers.scheduler.wait(100) })
