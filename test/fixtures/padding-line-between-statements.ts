const before = 1
if (before) {
  work()
}
const after = 2

export const firstExport = 1
export const secondExport = 2
export const handler = () => {
  work()
}
export function run() {}
export class Runner {}
export default function main() {}
