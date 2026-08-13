const firstRows = sql<{ id: number }>`select id from accounts`
const secondRows = db.sql<{ id: number }>`select id from accounts`
const thirdRows = database.client.sql<{ id: number }>`select id from accounts`
