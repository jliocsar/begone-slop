const firstRows = sql<{ id: number }>`select id from accounts`
const secondRows = db.sql<{ id: number }>`select id from accounts`
const thirdRows = database.client.sql<{ id: number }>`select id from accounts`
const unsafeRows = sql.unsafe<{ id: number }>('select id from accounts')
const memberUnsafeRows = db.sql.unsafe<{ id: number }>('select id from accounts')
const computedRows = db['sql']<{ id: number }>`select id from accounts`
const renamedSql = sql
const renamedRows = renamedSql<{ id: number }>`select id from accounts`
