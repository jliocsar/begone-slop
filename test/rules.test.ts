/**
 * The local rules, tested through oxlint — the runtime they actually run in,
 * including the JS-plugin bridge. (ESLint's `RuleTester` is also not an option:
 * typescript-eslint refuses to load against TypeScript 7.)
 *
 * Each case runs its fixture with only its own rule enabled — the fixtures are
 * deliberately malformed and would otherwise trip each other's rules.
 */

import { expect, test } from 'bun:test'
import * as Schema from 'effect/Schema'
import * as SchemaParser from 'effect/SchemaParser'

/** `--bun`: the plugin is TypeScript, which Node cannot import. */
const OXLINT = ['bunx', '--bun', 'oxlint']

/**
 * Absolute, so the harness does not depend on the cwd the gate invokes it from.
 * Built by descending from `import.meta.dir`, never `..` — oxlint rejects any
 * path containing one outright ("PATH must not contain `..`").
 */
const FIXTURES = `${import.meta.dir}/fixtures`
const VALID_FIXTURES = `${import.meta.dir}/fixtures/valid`
const CONFIGS = `${import.meta.dir}/tmp`

/** Mirrors `.oxlintrc.json`, by hand: that file is JSONC and cannot be parsed. */
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

/** `padding-line-between-statements` is the only rule here taking options. */
type PaddingSpec = typeof PADDING_SPEC

/** Fixture file per rule, and the 1-indexed lines that must be reported. */
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
  // Line 6 twice: the rule reports per offending param, and that line has two.
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
  // Line 7 twice: `catchTags` with two silent handlers reports per handler, on the call.
  { rule: 'no-silent-error-swallow', lines: [1, 2, 3, 4, 5, 6, 7, 7, 8, 9, 10] },
  // Both start at line 2: line 1 is the `Array` import that arms the rule.
  { rule: 'no-shadowed-standard-array-static', lines: [2, 3, 4, 5, 6] },
  { rule: 'no-nested-effect-array-methods', lines: [2, 3, 4, 5] },
  { rule: 'prefer-option-from-nullable', lines: [1, 2, 3, 4, 5, 6] },
  { rule: 'prefer-effect-match', lines: [1, 2, 3, 4, 5, 6] },
  // Tested but NOT enabled in `preset.json`: it fires on every file in the repo
  // until the comment-to-`docs/` migration runs. Each case enables its own rule.
  { rule: 'no-comments', lines: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
  // Line 15 twice: `a.pipe(…).pipe(…)` is two pipe calls starting on one line.
  { rule: 'no-cascading-layer-provide', lines: [4, 5, 6, 7, 8, 9, 14, 15, 15, 18] },
  // Lines 3 and 4 twice: two nested arguments, then a three-level nest.
  { rule: 'no-nested-layer-provide', lines: [1, 2, 3, 3, 4, 4, 5, 8] },
  // The whole file is the unit, so the single report lands on the Program.
  { rule: 'no-reexport-only-modules', lines: [1] },
  { rule: 'no-unsafe-dictionary-type', lines: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14] },
  // Lines 1-5 are the prelude the widening cases need; 17 is a safe generic alias.
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
  // Tested but NOT enabled, like `no-comments`: 6 genuine runtime `typeof`
  // checks in this package would fail the gate until they are reworked.
  { rule: 'no-runtime-typeof', lines: [1, 2, 3, 4, 5, 6, 7, 8, 8, 9, 10] },
]

/**
 * `oxlint -f json`, decoded rather than narrowed by hand. A change in oxlint's
 * output format then surfaces as a decode failure naming the missing field,
 * instead of as `undefined` line numbers. `NonEmptyArray` is what makes the
 * first label a value rather than a possibly-absent one.
 */
const OxlintReport = Schema.Struct({
  diagnostics: Schema.Array(
    Schema.Struct({
      code: Schema.String,
      labels: Schema.NonEmptyArray(Schema.Struct({ span: Schema.Struct({ line: Schema.Finite }) })),
    }),
  ),
})

const decodeReport = SchemaParser.decodeUnknownSync(OxlintReport)

/**
 * Rules owning a `fixtures/valid/` counterpart, read from disk rather than
 * listed by hand — a list would drift, and a rule quietly losing its valid
 * fixture is exactly the regression this pass exists to catch.
 */
const RULES_WITH_VALID_FIXTURE = new Set(
  globalThis.Array.from(new Bun.Glob('*.ts').scanSync({ cwd: VALID_FIXTURES }), (entry) =>
    entry.replace(/\.ts$/u, ''),
  ),
)

/**
 * Lines reported by `rule` against its own fixture. Only `begone-slop(…)`
 * diagnostics count — oxlint keeps its default correctness rules on, and
 * `no-unused-vars` fires on every fixture.
 */
async function reportedLines(
  rule: string,
  options: PaddingSpec | undefined,
  fixturePath: string,
): Promise<number[]> {
  const configPath = `${CONFIGS}/oxlint-${rule}.json`
  const ruleSetting = options === undefined ? 'error' : ['error', options]

  await Bun.write(
    configPath,
    JSON.stringify({
      // Resolved relative to the config file, which sits in `test/tmp/`.
      jsPlugins: ['../../src/index.ts'],
      rules: { [`begone-slop/${rule}`]: ruleSetting },
    }),
  )

  const result = await Bun.$`${OXLINT} -c ${configPath} -f json ${fixturePath}`.nothrow().quiet()

  return decodeReport(JSON.parse(result.stdout.toString()))
    .diagnostics.filter((diagnostic) => diagnostic.code === `begone-slop(${rule})`)
    .map((diagnostic) => diagnostic.labels[0].span.line)
    .sort((left, right) => left - right)
}

for (const { rule, lines, options } of CASES) {
  test(`${rule} rejects its fixture`, async () => {
    const reported = await reportedLines(rule, options, `${FIXTURES}/${rule}.ts`)

    expect(reported).toEqual(lines)
  })
}

for (const rule of RULES_WITH_VALID_FIXTURE) {
  test(`${rule} accepts its valid fixture`, async () => {
    const options = CASES.find((testCase) => testCase.rule === rule)?.options
    const reported = await reportedLines(rule, options, `${VALID_FIXTURES}/${rule}.ts`)

    expect(reported).toEqual([])
  })
}

test('every valid fixture belongs to a rule under test', () => {
  const known = new Set(CASES.map((testCase) => testCase.rule))
  const orphaned = globalThis.Array.from(RULES_WITH_VALID_FIXTURE).filter(
    (rule) => !known.has(rule),
  )

  expect(orphaned).toEqual([])
})
