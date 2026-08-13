const keptOn = { disableValidation: false }
const shorthand = { disableValidation }
const fromVariable = { disableValidation: flag }
const stringly = { disableValidation: 'true' }
const anotherOption = { disableParsing: true }
const method = { disableValidation() { return true } }
options.disableValidation = true
decodeUser(payload, { errors: 'all' })
