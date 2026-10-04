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
jest.setMock('./user-store', {})
vitest.mock('./user-store')
import { vitest as vitestUtils } from 'vitest'
vitestUtils.mock('./user-store')
import * as vitestModule from 'vitest'
vitestModule.vi.mock('./user-store')
vitestModule['vitest'].doMock('./user-store')
import * as bunTest from 'bun:test'
bunTest.mock.module('./user-store', () => ({}))
