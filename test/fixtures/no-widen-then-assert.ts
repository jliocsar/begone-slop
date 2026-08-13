const alphaValue = { first: 1 } as unknown
const alphaNarrow = alphaValue as { first: number }
const betaValue: unknown = 'text'
const betaNarrow = betaValue as string
const gammaValue: Record<string, unknown> = { first: 1 }
const gammaNarrow = gammaValue as { first: number }
const deltaValue: object = { first: 1 }
const deltaNarrow = deltaValue as { first: number }
const epsilonValue = [1, 2] as unknown
const epsilonNarrow = <number[]>epsilonValue
const zetaSource: { first: number } = { first: 1 }
const zetaValue: unknown = zetaSource
const zetaNarrow = zetaValue as { first: number }
function etaScope() {
  const etaValue: unknown = () => 1
  const etaNarrow = etaValue as () => number
  return etaNarrow
}
