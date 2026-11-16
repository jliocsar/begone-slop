const tooDeep = first ? one : second ? two : third ? three : fallback
const nestedConsequent = first ? (second ? (third ? three : other) : two) : fallback
const throughAssertion = first ? ((second ? two : third ? three : fallback) as string) : other
const throughNonNull = first ? (second ? two : third ? three : fallback)! : other
const inTheTest = (first ? (second ? (third ? one : two) : three) : four) ? yes : no
