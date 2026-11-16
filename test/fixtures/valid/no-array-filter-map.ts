import { Array as EffectArray } from 'effect'

const users = [first, second]
const fetched = fetchUsers()
let reassigned = [first]
reassigned = other

users.values().filter(isActive).map(toEmail).toArray()
Iterator.from(users).filter(isActive).map(toEmail).toArray()
users.flatMap((user) => (user.active ? [user.email] : []))
users.map(toEmail).map(normalize)
users.filter(isActive).filter(isVerified)
users.map(toEmail)
users.filter(isActive)
fetched.filter(isActive).map(toEmail)
reassigned.filter(isActive).map(toEmail)
users[method](isActive).map(toEmail)
EffectArray.map(EffectArray.filter(users, isActive), toEmail)

function collect(unknownReceiver: Users) {
  return unknownReceiver.filter(isActive).map(toEmail)
}

function shadowed(Object: Keyed) {
  return Object.keys(record).filter(isPublic).map(toLabel)
}
