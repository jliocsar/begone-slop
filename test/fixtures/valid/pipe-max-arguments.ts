// Exactly twenty is the limit, not one past it.
const atTheLimit = source.pipe(s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14, s15, s16, s17, s18, s19, s20)

// The standalone form is untouched, matching the rule this was ported from.
const standalone = pipe(source, s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14, s15, s16, s17, s18, s19, s20, s21)

// Some other method, however long.
const otherMethod = source.map(s1, s2, s3, s4, s5, s6, s7, s8, s9, s10, s11, s12, s13, s14, s15, s16, s17, s18, s19, s20, s21)

// Two short pipes rather than one long one: the split this rule asks for.
const firstHalf = source.pipe(s1, s2, s3)
const secondHalf = firstHalf.pipe(s4, s5, s6)
