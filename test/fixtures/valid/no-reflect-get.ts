Reflect.has(owner, key)
Reflect.ownKeys(owner)
const reader = { get(target, key) { return target[key] } }
reader.get(owner, key)
const methodFromAVariable = 'get'
Reflect[methodFromAVariable](owner, key)
const referenceWithoutACall = Reflect.get
function takesItsOwnReflect(Reflect) {
  return Reflect.get(owner, key)
}
function hasALocalReflect() {
  const Reflect = { get: read }

  return Reflect.get(owner, key)
}
