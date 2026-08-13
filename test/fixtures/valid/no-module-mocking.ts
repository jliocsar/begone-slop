import { mock } from 'bun:test'
import { vi as helperVi } from './helpers'
import { mock as helperMock } from './helpers'
vi.spyOn(store, 'save')
jest.spyOn(store, 'save')
vi.fn()
jest.requireActual('./user-store')
mock(() => 42)
mock.mockRestore()
mock.doMock('./user-store')
jest.module('./user-store')
vi.module('./user-store')
helperMock.module('./user-store', () => ({}))
helperVi.mock('./user-store')
const methodFromAVariable = 'mock'
vi[methodFromAVariable]('./user-store')
const mockWithoutACall = vi.mock
function takesTheRunnerAsAParameter(jest: { mock(): void }) {
  jest.mock()
}
function hasItsOwnLocalMocker() {
  const vi = { mock() {} }
  vi.mock('./user-store')
  const mock = { module() {} }
  mock.module('./user-store')
}
class DerivedFromABase extends Base {
  constructor() {
    super()
  }
  module() {}
  run() {
    this.module()
  }
}
