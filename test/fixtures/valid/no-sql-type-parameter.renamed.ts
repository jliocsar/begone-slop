const unsafeUntyped = sql.unsafe('select id from accounts')
const otherUnsafe = client.unsafe<{ id: number }>('select id from accounts')
const otherComputed = db['query']<{ id: number }>`select id from accounts`
const renamedOther = graphql
const renamedOtherRows = renamedOther<{ id: number }>`query { id }`
let reassignedSql = sql
reassignedSql = graphql
const reassignedRows = reassignedSql<{ id: number }>`query { id }`
