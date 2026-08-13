// An untyped template asserts nothing about the rows.
const rows = sql`select id from accounts`
const memberRows = db.sql`select id from accounts`

// Some other tag, typed or not.
const typedElsewhere = graphql<{ id: number }>`query { id }`
const untaggedCall = sql<{ id: number }>('select id from accounts')

// The type argument belongs to the call, not to a template.
const decoded = client.query<{ id: number }>()

// A property merely ending in `sql`.
const namesake = db.rawsql`select id from accounts`

// The shape this rule points at: the row type is proved, not asserted.
const proved = SqlSchema.findAll({ Result: Account, execute: () => sql`select id from accounts` })
