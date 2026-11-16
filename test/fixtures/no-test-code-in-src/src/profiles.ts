import { fakeUser } from '../test/support/users.ts'
export { layerStub } from './test/layers.ts'
export const layerTest = Profiles.layer
export const ProfilesTestLayer = Profiles.layer
export function makeFakeProfile() {}
export class Profiles { static layerMock = 1 }
const loaded = import('../tests/fixtures.ts')
export * from '../test/everything.ts'
export const profiles = fakeUser
