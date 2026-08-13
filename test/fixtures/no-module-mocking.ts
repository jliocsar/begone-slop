vi.mock('./user-store')
jest.mock('./user-store')
vi['doMock']('./user-store')
jest.unstable_mockModule('./user-store')
import { vi as vitestApi } from 'vitest'
vitestApi.mock('./user-store')
import { jest as jestApi } from '@jest/globals'
jestApi.doMock('./user-store')
import { mock } from 'bun:test'
mock.module('./user-store', () => ({ save: () => undefined }))
import { mock as bunMock } from 'bun:test'
bunMock['module']('./user-store', () => ({ save: () => undefined }))
