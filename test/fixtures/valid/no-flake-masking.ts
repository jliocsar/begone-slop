test('runs plainly', async () => {})
test.each([[1, 2]])('runs a table %i', async () => {})
test('takes other options', { concurrent: true }, async () => {})
beforeAll(async () => {}, 30_000)
vi.setConfig({ restoreMocks: true })
const config = { test: { environment: 'node' } }
helpers.setConfig({ testTimeout: 10 })
const retry = 3
test('names a variable retry', async () => { expect(retry).toBe(3) })
describe('a suite', () => {})
