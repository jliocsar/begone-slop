const single = condition ? left : right
const twoDeep = first ? one : second ? two : fallback
const separate = first ? pick(second ? two : three) : pick(third ? four : five)
const inCallback = items.map((item) => (item.done ? done : item.late ? late : pending))
