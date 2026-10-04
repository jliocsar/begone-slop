const plain = (
  <List>
    <Item value={value as string} />
  </List>
)
const noted = (
  <List>
    {/* NOTE: a plain JSX comment is not a justification */}
    <Item value={value as string} />
  </List>
)
const separated = (
  <List>
    {/* SAFETY: this justifies the first item only */}
    <Item value={first as string} />
    <Item value={second as string} />
  </List>
)
