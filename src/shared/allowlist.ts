import type { Context, Diagnostic, ESTree, Options } from '@oxlint/plugins'

type AllowlistOptions = {
  readonly allow: Readonly<Record<string, number>>
}

type Allowance = {
  readonly path: string
  readonly allowed: number
}

const PATH_SEPARATOR = '/'
const WINDOWS_SEPARATOR = /\\/gu
const NO_ALLOWANCE: Allowance = { path: '', allowed: 0 }

const STALE_ALLOWANCE_MESSAGE =
  '`{{path}}` is allowed {{allowed}} of these but has only {{count}} left. Bring its entry down to match, and drop it once it reaches 0, so the allowance only ever shrinks.'

export const ALLOWLIST_PROPERTIES = {
  allow: { type: 'object', additionalProperties: { type: 'integer', minimum: 1 } },
} as const

export const ALLOWLIST_MESSAGES = { staleAllowance: STALE_ALLOWANCE_MESSAGE }

function matchesFile(filename: string, path: string): boolean {
  return filename === path || filename.endsWith(`${PATH_SEPARATOR}${path}`)
}

function allowanceFor(options: Readonly<Options>, filename: string): Allowance {
  // SAFETY: oxlint validates configured options against meta.schema before create runs
  const configured = options[0] as Partial<AllowlistOptions> | undefined
  const normalised = filename.replace(WINDOWS_SEPARATOR, PATH_SEPARATOR)

  const entry = Object.entries(configured?.allow ?? {}).find(([path]) =>
    matchesFile(normalised, path),
  )

  return entry === undefined ? NO_ALLOWANCE : { path: entry[0], allowed: entry[1] }
}

export function reportBeyondAllowance(
  context: Context,
  program: ESTree.Program,
  diagnostics: readonly Diagnostic[],
): void {
  const { path, allowed } = allowanceFor(context.options, context.filename)
  const count = diagnostics.length

  if (count < allowed) {
    context.report({ node: program, messageId: 'staleAllowance', data: { path, allowed, count } })

    return
  }

  if (count === allowed) {
    return
  }

  for (const diagnostic of diagnostics) {
    context.report(diagnostic)
  }
}
