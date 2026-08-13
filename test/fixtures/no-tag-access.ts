if (error._tag === 'NotFound') { destroy() }
switch (result._tag) { case 'Success': break }
const { _tag } = error
if (error.reason._tag === 'UniqueViolation') { retry() }
