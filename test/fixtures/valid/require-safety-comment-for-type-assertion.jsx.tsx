const view = (
  <List>
    {/* SAFETY: value was checked by the caller */}
    <Item value={value as string} />
  </List>
)
const inline = (
  <List>
    {/* SAFETY: value was checked by the caller */}
    {value as string}
  </List>
)
const fragment = (
  <>
    {/* SAFETY: value was checked by the caller */}

    <Item value={value as string} />
  </>
)
