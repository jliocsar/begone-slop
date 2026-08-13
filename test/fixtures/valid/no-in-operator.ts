for (const key in record) {
  read(key)
}

const keys = Object.keys(record)
const hasStatus = Predicate.hasProperty(response, 'status')
const included = keys.includes('status')
const inWord = describeIn(response)
const inString = 'the key is in the record'
