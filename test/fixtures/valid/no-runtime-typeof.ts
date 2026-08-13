const CONFIGURED = { retries: 3 }

type Configured = typeof CONFIGURED

type Retries = (typeof CONFIGURED)['retries']

type Keys = keyof typeof CONFIGURED

declare const global: typeof globalThis

function queried(input: typeof CONFIGURED): typeof CONFIGURED {
  return input
}

const label = 'typeof'

const negated = !CONFIGURED

const voided = void 0

const numeric = -CONFIGURED.retries

const bitwise = ~CONFIGURED.retries

const deleted = delete CONFIGURED.retries
