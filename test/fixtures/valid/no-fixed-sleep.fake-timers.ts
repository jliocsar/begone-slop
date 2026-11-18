import { setTimeout as sleep } from 'node:timers/promises'
vi.useFakeTimers()
test('advances fake time', async () => { const slept = sleep(1000); vi.advanceTimersByTime(1000); await slept })
test('awaits a faked sleep', async () => { await sleep(1000) })
