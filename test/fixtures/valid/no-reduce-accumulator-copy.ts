items.reduce((acc, item) => { acc.push(item); return acc }, [])
items.reduce((acc, item) => Object.assign(acc, item), {})
items.reduce((acc, item) => { acc[item.id] = { ...item }; return acc }, {})
items.reduce((acc, item) => acc.concat(item), '')
items.reduce((acc, item) => acc.concat(item), custom)
items.reduce((acc, item) => acc + item.size, 0)
items.reduce((acc, item) => combine(...acc, item), [])
items.reduce((acc, item) => { const snapshot = () => ({ ...acc }); return register(acc, snapshot, item) }, {})
items.reduce(combine, {})
items.map((acc) => ({ ...acc }))

function rebuild(Object: Assigner) {
  return items.reduce((acc, item) => Object.assign({}, acc, item), {})
}
