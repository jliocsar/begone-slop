const TEST_FILE = /\.(?:spec|test)\.[cm]?[jt]sx?$/u

export function isTestFile(filename: string): boolean {
  return TEST_FILE.test(filename)
}
