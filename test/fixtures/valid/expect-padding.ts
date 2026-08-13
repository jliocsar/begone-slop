const result = run()

expect(result.ok).toBe(true)
expect(result.body).toBe('hi')
// a note on its own line is content, so the gap it opens is not the rule's
expect(result.status).toBe(302)

const second = await run()

await expect(second.body).resolves.toBe('hi')
expect(second.ok).toBe(true)

function assertsInsideABlock() {
  const value = compute()

  expect(value).toBe(1)
  expect(value).not.toBe(2)
}
