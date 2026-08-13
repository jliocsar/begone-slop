import { expect, test } from 'bun:test'
import * as Schema from 'effect/Schema'
import * as SchemaParser from 'effect/SchemaParser'
import plugin from '../src/index.ts'

const OXLINT = ['bunx', '--bun', 'oxlint']

const FIXTURES = `${import.meta.dir}/fixtures`
const VALID_FIXTURES = `${import.meta.dir}/fixtures/valid`
const CONFIGS = `${import.meta.dir}/tmp`

const PADDING_SPEC = [
  { blankLine: 'always', prev: '*', next: 'return' },
  { blankLine: 'always', prev: '*', next: 'block-like' },
  { blankLine: 'always', prev: 'block-like', next: '*' },
  { blankLine: 'always', prev: '*', next: ['function', 'class'] },
  { blankLine: 'always', prev: ['function', 'class'], next: '*' },
  { blankLine: 'always', prev: 'import', next: '*' },
  { blankLine: 'any', prev: 'import', next: 'import' },
  {
    blankLine: 'any',
    prev: ['singleline-const', 'singleline-let'],
    next: ['singleline-const', 'singleline-let'],
  },
]

type PaddingSpec = typeof PADDING_SPEC

const CASES: { rule: string; lines: number[]; options?: PaddingSpec }[] = [
  { rule: 'no-tag-access', lines: [1, 2, 3, 4] },
  { rule: 'no-shadowed-error-field', lines: [1, 2] },
  { rule: 'expect-padding', lines: [2, 4] },
  { rule: 'padding-line-between-statements', lines: [2, 5], options: PADDING_SPEC },
  { rule: 'statement-order', lines: [5] },
  { rule: 'no-switch', lines: [1, 2] },
  { rule: 'no-try-catch', lines: [1, 2] },
  { rule: 'no-in-operator', lines: [1, 2] },
  { rule: 'no-service-option', lines: [1, 2, 3] },
  { rule: 'no-effect-asvoid', lines: [1, 2, 3] },
  { rule: 'no-disable-validation', lines: [1, 2, 3, 4] },
  { rule: 'no-banned-type-assertions', lines: [1, 2, 3, 4, 5] },
  { rule: 'no-optional-function-parameters', lines: [1, 2, 3, 4, 5, 6, 6] },
  { rule: 'no-sql-type-parameter', lines: [1, 2, 3] },
  { rule: 'pipe-max-arguments', lines: [1] },
  { rule: 'no-reflect-get', lines: [1, 2] },
  { rule: 'no-reflect-apply', lines: [1, 2] },
  { rule: 'no-conditional-empty-object-spread', lines: [1, 2, 3, 4, 5, 6] },
  { rule: 'require-safety-comment-for-type-assertion', lines: [1, 2, 3, 4, 5] },
  { rule: 'no-chained-type-assertions', lines: [1, 2, 3, 4, 5] },
  { rule: 'no-unknown-parameters', lines: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
  { rule: 'no-unknown-returns', lines: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16] },
  { rule: 'no-unknown-type-aliases', lines: [1, 2, 3, 4, 5, 6, 7] },
  { rule: 'no-silent-error-swallow', lines: [1, 2, 3, 4, 5, 6, 7, 7, 8, 9, 10] },
  { rule: 'no-shadowed-standard-array-static', lines: [2, 3, 4, 5, 6] },
  { rule: 'no-nested-effect-array-methods', lines: [2, 3, 4, 5] },
  { rule: 'prefer-option-from-nullable', lines: [1, 2, 3, 4, 5, 6] },
  { rule: 'prefer-effect-match', lines: [1, 2, 3, 4, 5, 6] },
  { rule: 'no-comments', lines: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  { rule: 'no-cascading-layer-provide', lines: [4, 5, 6, 7, 8, 9, 14, 15, 15, 18] },
  { rule: 'no-nested-layer-provide', lines: [1, 2, 3, 3, 4, 4, 5, 8] },
  { rule: 'no-reexport-only-modules', lines: [1] },
  { rule: 'no-unsafe-dictionary-type', lines: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
  {
    rule: 'no-known-value-widening',
    lines: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22, 23, 24],
  },
  { rule: 'no-widen-then-assert', lines: [2, 4, 6, 8, 10, 13, 16] },
  {
    rule: 'no-object-parameters',
    lines: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 19, 20, 20],
  },
  { rule: 'no-module-mocking', lines: [1, 2, 3, 4, 6, 8, 10, 12] },
  { rule: 'no-runtime-typeof', lines: [1, 2, 3, 4, 5, 6, 7, 8, 8, 9, 10] },
]

const OxlintReport = Schema.Struct({
  diagnostics: Schema.Array(
    Schema.Struct({
      code: Schema.String,
      message: Schema.String,
      labels: Schema.NonEmptyArray(Schema.Struct({ span: Schema.Struct({ line: Schema.Finite }) })),
    }),
  ),
})

const decodeReport = SchemaParser.decodeUnknownSync(OxlintReport)

const RULES_WITH_VALID_FIXTURE = new Set(
  globalThis.Array.from(new Bun.Glob('*.ts').scanSync({ cwd: VALID_FIXTURES }), (entry) =>
    entry.replace(/\.ts$/u, ''),
  ),
)

async function runRule(
  rule: string,
  options: PaddingSpec | undefined,
  fixturePath: string,
): Promise<{ lines: number[]; messages: string[] }> {
  const configPath = `${CONFIGS}/oxlint-${rule}.json`
  const ruleSetting = options === undefined ? 'error' : ['error', options]

  await Bun.write(
    configPath,
    JSON.stringify({
      jsPlugins: ['../../src/index.ts'],
      rules: { [`begone-slop/${rule}`]: ruleSetting },
    }),
  )

  const result = await Bun.$`${OXLINT} -c ${configPath} -f json ${fixturePath}`.nothrow().quiet()
  const reported = decodeReport(JSON.parse(result.stdout.toString())).diagnostics.filter(
    (diagnostic) => diagnostic.code === `begone-slop(${rule})`,
  )

  return {
    lines: reported
      .map((diagnostic) => diagnostic.labels[0].span.line)
      .sort((left, right) => left - right),
    messages: reported.map((diagnostic) => diagnostic.message),
  }
}

for (const { rule, lines, options } of CASES) {
  test(`${rule} rejects its fixture`, async () => {
    const { lines: reported, messages } = await runRule(rule, options, `${FIXTURES}/${rule}.ts`)
    const unrendered = messages.filter((message) => message.includes('{{') || message.length === 0)

    expect(reported).toEqual(lines)
    expect(unrendered).toEqual([])
  })
}

for (const rule of RULES_WITH_VALID_FIXTURE) {
  test(`${rule} accepts its valid fixture`, async () => {
    const options = CASES.find((testCase) => testCase.rule === rule)?.options
    const { lines: reported } = await runRule(rule, options, `${VALID_FIXTURES}/${rule}.ts`)

    expect(reported).toEqual([])
  })
}

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
