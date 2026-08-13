let alphaValue: unknown = 'text'
alphaValue = 'other'
const alphaNarrow = alphaValue as string
const betaValue: unknown = compute()
const betaNarrow = betaValue as string
const gammaValue = { first: 1 }
const gammaNarrow = gammaValue as { first: number }
const deltaValue: unknown = 'text'
const deltaNarrow = deltaValue as unknown
const epsilonValue: Record<string, unknown> = { first: 1 }
const epsilonNarrow = epsilonValue as { [key: string]: number }
const zetaValue: object = { first: 1 }
const zetaNarrow = zetaValue as string
const [etaItem]: any = [1]
const etaNarrow = etaItem as number
const thetaNarrow = ({ first: 1 } as unknown) as { first: number }
const iotaValue: unknown = 'text'
function iotaScope() {
  return iotaValue as string
}
function kappaScope() {
  const kappaEarly = kappaValue as string
  const kappaValue: unknown = 'text'
  return [kappaEarly, kappaValue]
}
function lambdaOuter() {
  const lambdaValue: unknown = 'text'
  return function lambdaInner() {
    return lambdaValue as string
  }
}
