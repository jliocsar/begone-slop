const result = run()
expect(result.ok).toBe(true)

expect(result.body).toBe('hi')

const parsed = run()
// @ts-expect-error invalid input on purpose
expect(parse(parsed)).toBe(1)
// oxlint-disable-next-line no-console
console.log(parsed)
