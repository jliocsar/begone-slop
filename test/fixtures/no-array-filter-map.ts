[1, 2, 3].filter(isEven).map(double)
;[1, 2, 3].map(double).filter(isEven)
users.filter(isActive).map(toEmail)
alias.map(toEmail).filter(isPresent)
typed.filter(isActive).map(toEmail)
readonlyTyped.map(toEmail).filter(isPresent)
generic.filter(isActive).map(toEmail)
users['filter'](isActive)['map'](toEmail)
users?.filter(isActive)?.map(toEmail)
users.slice(1).filter(isActive).map(toEmail)
Object.keys(record).filter(isPublic).map(toLabel)
users.filter(isActive).map(toEmail).filter(isPresent)
Array.from(source).map(toEmail).filter(isPresent)
;(users as User[]).filter(isActive).map(toEmail)
const users = [first, second]
const alias = users
declare const typed: User[]
declare const readonlyTyped: readonly User[]
declare const generic: ReadonlyArray<User>
