import { expect, test } from 'bun:test'
import preset from '../preset.json' with { type: 'json' }
import plugin from '../src/index.ts'

const OXLINT = ['bunx', '--bun', 'oxlint']
const FIXTURES = `${import.meta.dir}/fixtures`
const VALID_FIXTURES = `${import.meta.dir}/fixtures/valid`
const CONFIGS = `${import.meta.dir}/tmp`
const PRESET_RULE_SETTINGS = new Map(Object.entries(preset.rules))

const CASES: { rule: string; lines: number[]; fixture?: string }[] = [
  { rule: 'no-tag-access', lines: [1, 2, 3, 4] },
  { rule: 'no-shadowed-error-field', lines: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { rule: 'expect-padding', lines: [2, 4, 8, 10] },
  {
    rule: 'padding-line-between-statements',
    lines: [
      2, 5, 9, 12, 13, 14, 21, 25, 28, 36, 40, 47, 51, 54, 59, 62, 67, 71, 76, 77, 80, 81, 82, 87,
      88,
    ],
  },
  {
    rule: 'padding-line-between-statements',
    fixture: 'padding-line-between-statements.export-default.ts',
    lines: [2, 5],
  },
  { rule: 'statement-order', lines: [5] },
  {
    rule: 'statement-order',
    fixture: 'statement-order.exported-constants.ts',
    lines: [4, 9],
  },
  { rule: 'no-switch', lines: [1, 2] },
  { rule: 'no-try-catch', lines: [1, 2] },
  { rule: 'no-in-operator', lines: [1, 2] },
  { rule: 'no-service-option', lines: [1, 2, 3, 7, 8, 9] },
  { rule: 'no-effect-asvoid', lines: [1, 2, 3, 7, 8, 9, 10] },
  { rule: 'no-disable-validation', lines: [1, 2, 3, 4, 5, 6] },
  { rule: 'no-banned-type-assertions', lines: [1, 2, 3, 4, 5] },
  { rule: 'no-optional-function-parameters', lines: [1, 2, 3, 4, 5, 6, 6] },
  { rule: 'no-sql-type-parameter', lines: [1, 2, 3, 4, 5, 6, 8] },
  { rule: 'pipe-max-arguments', lines: [1] },
  { rule: 'no-reflect-get', lines: [1, 2] },
  { rule: 'no-reflect-apply', lines: [1, 2] },
  { rule: 'no-conditional-empty-object-spread', lines: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
  { rule: 'require-safety-comment-for-type-assertion', lines: [1, 2, 3, 4, 5, 10, 13, 16, 21] },
  {
    rule: 'require-safety-comment-for-type-assertion',
    fixture: 'require-safety-comment-for-type-assertion.jsx.tsx',
    lines: [3, 9, 16],
  },
  { rule: 'no-chained-type-assertions', lines: [1, 2, 3, 4, 5, 6, 7] },
  { rule: 'no-unknown-parameters', lines: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
  {
    rule: 'no-unknown-returns',
    lines: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 20, 21],
  },
  { rule: 'no-unknown-type-aliases', lines: [1, 2, 3, 4, 5, 6, 7] },
  {
    rule: 'no-silent-error-swallow',
    lines: [1, 2, 3, 4, 5, 6, 7, 7, 8, 9, 10, 11, 12, 13, 14, 15, 15, 16, 17, 18, 22, 23, 24, 25],
  },
  {
    rule: 'no-silent-error-swallow',
    fixture: 'no-silent-error-swallow.ignore.ts',
    lines: [1, 2, 3, 4, 5, 6, 7, 8],
  },
  { rule: 'no-shadowed-standard-array-static', lines: [2, 3, 4, 5, 6] },
  { rule: 'no-nested-effect-array-methods', lines: [2, 6, 7, 8, 12, 13] },
  {
    rule: 'prefer-option-from-nullable',
    lines: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 17, 18, 19],
  },
  { rule: 'prefer-effect-match', lines: [1, 2, 3, 4, 5, 6, 7, 8] },
  { rule: 'no-comments', lines: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13] },
  {
    rule: 'no-cascading-layer-provide',
    lines: [4, 5, 6, 7, 8, 9, 14, 15, 15, 18, 20, 21, 22, 23],
  },
  { rule: 'no-service-layer-provide', lines: [2, 3, 4, 5, 6, 7, 10, 13] },
  { rule: 'no-nested-layer-provide', lines: [1, 2, 3, 3, 4, 4, 5, 8, 10, 11, 12, 13, 14] },
  { rule: 'no-reexport-only-modules', lines: [1] },
  { rule: 'no-unsafe-dictionary-type', lines: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
  {
    rule: 'no-known-value-widening',
    lines: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23, 24, 26, 27, 29, 30, 31],
  },
  { rule: 'no-widen-then-assert', lines: [2, 4, 6, 8, 10, 13, 16, 22, 24, 25, 26] },
  {
    rule: 'no-object-parameters',
    lines: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 19, 20, 20],
  },
  { rule: 'no-module-mocking', lines: [1, 2, 3, 4, 6, 8, 10, 12, 13, 14, 16, 18, 19, 21] },
  { rule: 'no-runtime-typeof', lines: [1, 2, 3, 4, 5, 6, 7, 8, 8, 9, 10] },
  { rule: 'max-ternary-depth', lines: [1, 2, 3, 4, 5] },
  { rule: 'no-array-filter-map', lines: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 12, 13, 14] },
  { rule: 'no-reduce-accumulator-copy', lines: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
  { rule: 'no-disabled-type-assertion-rules', lines: [1, 2, 2, 3, 4, 6, 8, 9, 11] },
  { rule: 'require-cause-when-narrowing', lines: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
  { rule: 'no-manual-tagged-construction', lines: [1, 2, 3, 4, 5, 6, 7, 8] },
  {
    rule: 'no-test-code-in-src',
    fixture: 'no-test-code-in-src/src/profiles.test.ts',
    lines: [1],
  },
  {
    rule: 'no-test-code-in-src',
    fixture: 'no-test-code-in-src/src/__tests__/helper.ts',
    lines: [1],
  },
  {
    rule: 'no-test-code-in-src',
    fixture: 'no-test-code-in-src/src/profiles.ts',
    lines: [1, 2, 2, 3, 4, 5, 6, 7, 8],
  },
  { rule: 'no-test-code-in-src', fixture: 'no-test-code-in-src/src/clean.ts', lines: [] },
  { rule: 'prefer-tagged-error-handling', lines: [1, 2, 3, 4, 5] },
  { rule: 'prefer-yield-service', lines: [2, 6, 10] },
  { rule: 'no-reprovide-ambient-service', lines: [3, 7] },
  { rule: 'no-service-parameters', lines: [1, 2, 3, 4, 5, 6, 7] },
  { rule: 'require-service-make-layer', lines: [1, 2, 3] },
  { rule: 'require-operation-span', lines: [9, 10, 11, 12, 13] },
]

const UNIX_REPORT_LINE =
  /^[^:]+:(?<line>\d+):\d+: (?<message>.*) \[(?:Error|Warning)\/(?<code>[^\]]+)\]$/u

const VALID_FIXTURE_FILES = globalThis.Array.from(
  new Bun.Glob('*.{ts,tsx,mts,cts}').scanSync({ cwd: VALID_FIXTURES }),
)

const RULES_WITH_VALID_FIXTURE = new Set(
  VALID_FIXTURE_FILES.map((fixtureFile) => fixtureFile.split('.')[0] ?? fixtureFile),
)

async function runRule(
  rule: string,
  fixturePath: string,
): Promise<{ lines: number[]; messages: string[]; exitCode: number }> {
  const configPath = `${CONFIGS}/oxlint-${rule}.json`
  const ruleSetting = PRESET_RULE_SETTINGS.get(`begone-slop/${rule}`) ?? 'error'

  await Bun.write(
    configPath,
    JSON.stringify({
      jsPlugins: ['../../src/index.ts'],
      rules: { [`begone-slop/${rule}`]: ruleSetting },
    }),
  )

  const result = await Bun.$`${OXLINT} -c ${configPath} -f unix ${fixturePath}`.nothrow().quiet()
  const reported = result.stdout
    .toString()
    .split('\n')
    .flatMap((reportLine) => {
      const diagnostic = UNIX_REPORT_LINE.exec(reportLine)?.groups

      return diagnostic === undefined ? [] : [diagnostic]
    })
    .filter((diagnostic) => diagnostic['code'] === `begone-slop(${rule})`)

  return {
    lines: reported
      .map((diagnostic) => Number(diagnostic['line']))
      .sort((left, right) => left - right),
    messages: reported.map((diagnostic) => diagnostic['message'] ?? ''),
    exitCode: result.exitCode,
  }
}

for (const { rule, lines, fixture = `${rule}.ts` } of CASES) {
  test(`${rule} rejects ${fixture}`, async () => {
    const { lines: reported, messages } = await runRule(rule, `${FIXTURES}/${fixture}`)
    const unrendered = messages.filter((message) => message.includes('{{') || message.length === 0)

    expect(reported).toEqual(lines)
    expect(unrendered).toEqual([])
  })
}

for (const fixtureFile of VALID_FIXTURE_FILES) {
  const rule = fixtureFile.split('.')[0] ?? fixtureFile

  test(`${rule} accepts valid/${fixtureFile}`, async () => {
    const { lines: reported, exitCode } = await runRule(rule, `${VALID_FIXTURES}/${fixtureFile}`)

    expect(exitCode).toBe(0)
    expect(reported).toEqual([])
  })
}

test('the preset turns on the oxlint rules it names', async () => {
  const configPath = `${CONFIGS}/oxlint-preset.json`

  await Bun.write(
    configPath,
    JSON.stringify({ extends: ['../../preset.json'], jsPlugins: ['../../src/index.ts'] }),
  )

  const result = await Bun.$`${OXLINT} -c ${configPath} -f unix ${FIXTURES}/preset-builtins.ts`
    .nothrow()
    .quiet()

  const codes = new Set(
    result.stdout
      .toString()
      .split('\n')
      .flatMap((reportLine) => UNIX_REPORT_LINE.exec(reportLine)?.groups?.['code'] ?? []),
  )

  expect(codes).toContain('typescript(ban-ts-comment)')
  expect(codes).toContain('eslint(max-depth)')
})

test('every rule the plugin defines is covered by both halves', () => {
  const defined = new Set(Object.keys(plugin.rules))
  const rejecting = new Set(CASES.map((testCase) => testCase.rule))
  const missingRejectingCase = globalThis.Array.from(defined).filter((rule) => !rejecting.has(rule))
  const missingCleanFixture = globalThis.Array.from(defined).filter(
    (rule) => !RULES_WITH_VALID_FIXTURE.has(rule),
  )
  const orphanedRejectingCase = globalThis.Array.from(rejecting).filter(
    (rule) => !defined.has(rule),
  )
  const orphanedCleanFixture = globalThis.Array.from(RULES_WITH_VALID_FIXTURE).filter(
    (rule) => !defined.has(rule),
  )

  expect(missingRejectingCase).toEqual([])
  expect(missingCleanFixture).toEqual([])
  expect(orphanedRejectingCase).toEqual([])
  expect(orphanedCleanFixture).toEqual([])
})
