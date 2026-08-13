Reflect.construct(Handler, argumentList)
Reflect.ownKeys(owner)
handler.apply(receiver, argumentList)
const invoker = { apply(target, receiver, argumentList) { return target(...argumentList) } }
invoker.apply(handler, receiver, argumentList)
const methodFromAVariable = 'apply'
Reflect[methodFromAVariable](handler, receiver, argumentList)
const referenceWithoutACall = Reflect.apply
function takesItsOwnReflect(Reflect) {
  return Reflect.apply(handler, receiver, argumentList)
}
function hasALocalReflect() {
  const Reflect = { apply: invoke }

  return Reflect.apply(handler, receiver, argumentList)
}
