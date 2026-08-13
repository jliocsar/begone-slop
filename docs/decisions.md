# Decision log

What this plugin already knows: what was tried, what was measured, what was decided and why. It is
written for anyone changing or adding a rule here — most of it is traps that cost somebody an
afternoon, in the parser, in the linter's JS-plugin API, and in resolving types without a type
checker. Read it before changing anything, so you do not re-derive a fact somebody already paid for.

Add to it whenever you measure something, settle a design question, or lose an afternoon: one fact
per bullet, the fact first and its consequence second, and say plainly when something was measured
rather than assumed. A fact that cannot be stated without naming a file, symbol or line is not worth
keeping — those rot faster than the knowledge does; drop it, or restate it as the general fact it is
an instance of. Naming a third-party API or a rule of ours is fine.

## Loading the plugin, and its traps

- The linter imports its JS plugins with whatever runtime is executing it, so a plugin written in
  TypeScript only loads when the linter itself is run by Bun. Under Node the import dies with
  `ERR_UNKNOWN_FILE_EXTENSION` (measured under Node 20 LTS) — unflagged type-stripping only arrived
  in Node 22.18. The published package therefore ships compiled ESM, which loads under either
  runtime; pointing a config at TypeScript source is a thing only this repo's own development setup
  can do, because it runs the linter under Bun.
- The linter's plugin list resolves a bare package specifier, but `extends` does not — an extended
  config is resolved relative to the config file that names it (measured). A consumer therefore
  names the package by its bare specifier to load the plugin, and reaches the shipped preset through
  its path inside the dependency directory. The two look inconsistent and are.
- Plugin paths listed in a config are resolved relative to that config file's own location, not the
  working directory of the invocation, and they may climb out of that directory freely (measured: a
  config generated into a scratch directory loads the plugin through a relative path spelled with
  `..`).
- Ignore globs are the opposite. They are rooted at the config file's own directory, and one
  containing `..` is refused as a configuration error before a single file is linted (measured). A
  generated config can therefore exclude nothing that sits outside the directory it was written to,
  so exclusion has to be arranged another way — by pointing the invocation at exactly the file to
  lint, for instance.
- A shipped preset must list its plugins explicitly, even as an empty list. Extending one that omits
  the key re-enables the linter's own default plugin set on top of it, failing a consumer's gate on
  rules nobody chose (measured: 7 reports). A preset that turns things on by omission is worse than
  no preset.
- The linter refuses a rule's options outright unless the rule's metadata carries a `schema` entry,
  and it does so before any user-level option decoding runs (measured). A permissive schema — one
  that only says the argument is an array — is enough to pass that gate, leaving the real validation
  to the rule.
- When a rule is configured as a bare severity string, the linter passes `undefined` for the first
  option slot (measured). An options schema therefore needs a default for the whole object as well
  as for each key.
- The linter accepts JSONC for its config, so a config carrying comments cannot be read back with a
  plain JSON parser. Any option spec a test needs to share with a config has to be mirrored by hand
  in the test, or kept in a comment-free file (measured).
- The linter's JS plugin support is alpha and explicitly not semver-bound, per its own shipped
  configuration schema. Every rule here rides on it, so a linter upgrade can break them without a
  major version bump; the rule suite is what catches that.

## What the parser actually produces

- The parser discards redundant parentheses: neither a parenthesized-expression nor a
  parenthesized-type node is ever emitted (measured by walking every node of a file written with
  doubled parentheses around both an expression and a type — only the operand nodes appeared). A
  rule matching an expression or type shape therefore needs no unwrapping branch, and any it carries
  is dead code that will never be exercised by a test.
- Comment text arrives with the leading `//` already stripped, so a triple-slash reference directive
  is seen as text beginning `/ <reference` (measured). An allowlist matching directive prefixes has
  to be written against the stripped form.
- The two type-assertion spellings are distinct node kinds — `x as T` and the angle-bracket `<T>x`
  (measured). A rule about assertions must register handlers for both or it silently misses half the
  cases.
- The `in` of a for-in statement is a different node from the binary `in` expression, so a rule
  banning `in` as an object-key probe needs no special case to leave iteration alone (measured).
- `typeof` in type position parses as a type-query node, entirely distinct from the runtime unary
  operator, so a rule visiting unary expressions never touches type-level `typeof`.
- An object property key appears as an identifier, a private identifier or a string literal, and all
  three spellings must be handled to match one option name reliably. Shorthand puts an identifier in
  the value position, so a check requiring a literal value leaves shorthand alone for free.
- A prologue directive and an ordinary expression statement share the same node type tag; both carry
  a `directive` field, and only a string value there marks a real directive. A bare string statement
  mid-file is not a directive.
- A call's callee is not always an ordinary expression — it can be `Super` or a V8 intrinsic. A rule
  matching on the callee must exclude those, unless it already requires a member expression, in
  which case the narrowing does it for free.
- A generic instantiation without a call inserts an instantiation-expression node between the call
  node and its member expression (measured). Any callee matcher must unwrap it or miss instantiated
  calls.
- Binding-pattern node types declare the `optional` field as the literal `false`, but the parser
  emits `true` for an optional parameter (measured). Detecting optional parameters requires a
  hand-written shape describing what the parser produces, not the shipped types. For a parameter
  property the flag sits on the wrapped inner parameter, not on the property node.
- Where a parameter's type annotation sits depends on how it was written: a parameter property wraps
  the real parameter, and a rest element or default-valued parameter may annotate either itself or
  the pattern it wraps. Extraction must check both positions, recursing through the wrappers.
- Type arguments on a tagged template appear under `typeArguments` in one spelling and
  `typeParameters` in the other, and which one a given build produces is not guaranteed (measured),
  so analysis code must read both.
- Every node type that carries a type-parameter list declares it as the same declaration type
  (measured across the shipped node types), so a structural property probe is enough to collect
  generic parameter names during an ancestor walk; enumerating node types is unnecessary.
- A node's parent link is null only on the program root, so a null check alongside an explicit
  program-root check is redundant at runtime but required to convince the type checker.
- One function interface covers all four value-level function kinds, discriminated by its type
  field, so shared fields read uniformly across the union; an arrow function simply declares its
  identifier as null.

## Working against the plugin API

- The visitor type intersects a catch-all record of string keys over its per-key handlers, which
  collapses every handler's parameter to the generic node type (measured). The visitor key gives no
  narrowing; narrow inside the handler body.
- The ancestor-walking API is typed against the linter's own node union, which the ESTree node type
  is not assignable to (measured). Helpers consuming ancestors must take a plain object parameter and
  probe fields structurally. The walk also runs root-inwards and excludes the node itself, so a rule
  needing the node's own data reads it separately.
- To resolve an identifier occurrence back to its binding, iterate the scope manager's scopes and
  match a reference by the span of its identifier node rather than asking for the scope at a
  location. A reference records the exact identifier it came from, so span matching always lands on
  the occurrence under inspection and never on a shadow of the same name.
- An "is this a global reference" check alone does not prove an identifier names a real global: a
  name the scope manager knows but nothing defines still resolves to a variable. Treat both a lookup
  miss and a resolved variable with zero definitions as the global; anything with a definition is
  somebody's own local.
- A rule depending on what a module imports must read the import declarations in one pass over the
  program body, never latch a flag from inside an import handler. Traversal order means any node
  visited before the import escapes a latched flag — a real bug found in upstream rules ported this
  way.
- A rule resolving type-alias and interface names must build its per-file type environment when the
  program node is visited, before any per-node check runs. Building it incrementally would fail for
  an annotation naming an alias declared further down the file.
- Generic subtree traversal cannot avoid untyped values: the shipped node types model only named,
  narrowed fields, so a walk over arbitrary keys has to accept `unknown` and index by arbitrary
  strings, opting out of this plugin's own bans with a targeted disable directive.
- Every node carries a back-pointer to its parent, so a naive recursive walk over a node's own keys
  never terminates. Skip the parent key and the positional keys (location, range, start, end — they
  carry no type information) and keep a visited set of already-seen objects.
- `Array.isArray` narrows an `unknown` value to `any[]`, putting an `any` back into every element
  read afterwards. Wrapping it in a guard returning `value is readonly unknown[]` keeps the
  narrowing honest.
- Deciding whether an ancestor is a written type node needs an explicit list of type node kinds
  rather than a structural guess: a type-argument list node sits between a type reference and its
  arguments, so not every ancestor in the chain is a type.
- A rule asserting that _every_ statement in a file matches a forbidden shape must also require the
  statement list to be non-empty, or an empty file satisfies the quantifier vacuously and gets
  reported for a pattern it does not contain.
- Matching a value against a closed set of literal names with an exhaustive matcher means adding a
  member to that set fails to compile until every dispatch site handles it — a cheap completeness
  guarantee for anything driven by a literal union of option values.

## Type resolution without a type checker

- Collecting a module's top-level type aliases once per file, before any function bodies are walked,
  makes forward references resolve: a function declared above the alias it returns, and an alias
  referring to one declared later, both resolve correctly (measured). Only aliases declared in the
  file itself are reachable; an imported alias is unresolvable to syntax-only analysis and must be
  left alone.
- Recursion needs a visited list to terminate on self-referential aliases, and the same applies to
  any interpreter following const bindings: two consts initialised from each other, or two aliases
  naming each other, otherwise recurse forever.
- A type reference carrying type arguments must end the resolution walk: an applied generic resolves
  to its arguments, not to the text written at the declaration. Only bare references to non-generic
  aliases are followed.
- A generic type parameter in lexical scope that shadows a top-level alias name also ends the walk.
  Mapped-type keys and `infer` bindings both introduce a type name with no type-parameter list and
  both shadow a same-named alias, so they must be collected from enclosing nodes alongside ordinary
  type parameters.
- `Promise` and `PromiseLike` are matched by name, so a locally shadowed one still counts as
  transparent (measured); awaiting either yields its first type argument, so the wrapper can be seen
  through.
- Built-in generic names (`Record`, `Readonly`, `Partial`, `Pick`, `Omit`, `PropertyKey` and
  friends) lose their built-in meaning for a whole file that declares or imports one, so a
  syntax-level interpreter must track shadowed built-ins per file.
- Indexing a file's type aliases from the _reversed_ declaration list makes the first declaration of
  a duplicated name win. A duplicated alias name is a compile error anyway, so no resolution order
  is the "right" one; picking the first keeps the choice stable instead of depending on where in the
  file the redeclaration landed.
- Applying a generic alias syntactically: a parameter with neither a supplied argument nor a default
  yields no binding at all, and each parameter's default must resolve against the bindings made by
  the parameters before it, matching how type-parameter defaults are scoped.
- Whitespace carries no meaning inside a type annotation, so two written types are compared for
  identity by stripping all whitespace from their source text.
- Syntactic evidence of what a value is can be followed through a const binding, but stops at a
  `let`, at a binding written anywhere other than its initializer, or at a name with more than one
  declaration — past those the value is no longer the one on the page. A write counts as "other than
  the initializer" when the scope reference is a write and is not flagged as the declaration's init.

## Classifying weak types

- Exactly three written shapes erase everything about a value while still typechecking: the top
  types (`unknown`, `any`), the `object` keyword, and a record whose keys are a key primitive
  (string, number, symbol, a union of them, or `PropertyKey`) and whose values are top — in either
  the generic-record or index-signature spelling, optionally wrapped in `Readonly`.
- An intersection is only as weak as its weakest member: intersecting a top type with a real named
  shape still names that shape and stays safe. `any` is the exception — it poisons the whole
  intersection regardless of what it is intersected with.
- An interface with a single declaration and an empty body is the empty-object escape hatch, but two
  declarations of the same name are declaration merging: the shape is open by design and must not be
  judged empty. A body made only of optional `never` members (the private-brand idiom) carries no
  data and still counts as empty.
- A named object alias with no index signature is deliberately _not_ a widening target — naming a
  concrete shape preserves the contract — whereas an anonymous object literal type is, because
  nothing named it. That asymmetry forces an alias's body to be classified by a stricter pass than
  the one applied at the entry point.
- When banning dictionary types whose value type is an escape hatch, only the direct value type
  counts: a record of concrete objects that happen to hold a weak field is a different complaint. An
  intersection keeps its concrete members; a built-in name the file declares or imports itself is no
  longer the built-in. Report only the outermost offender to avoid repeating one defect, and report
  a bare use of a locally declared alias at the alias declaration instead.

## Effect API constraints

- Fields declared on an Effect error schema class are assigned onto the instance, so a field called
  `name` or `stack` overwrites the properties that identify the value as an error (measured).
  Pretty-printed causes, the stack header and OTLP's `exception.type`/`exception.stacktrace` all
  read those properties, so the shadow destroys information at every reporting site. `message` and
  `cause` are the two exceptions and were measured safe — Effect gives `cause` Error's own meaning.
- The error-class factories are curried: the fields object sits on the arguments of the _outer_
  call while the factory name appears on the callee of the _inner_ one, which is where static
  analysis has to look for each (measured). The untagged sibling takes its fields in the same
  position.
- A callee written as a bare identifier, a namespaced member or an aliased namespace all name the
  same function; the import style is the caller's business, so matching on the last name segment
  identifies a factory regardless of how it was imported.
- Importing Effect's array module unaliased shadows the global `Array` constructor for the whole
  file, and the three standard statics anyone reaches for stop meaning what they read as (measured
  against the pinned Effect). `from` is not on the module at all — it spells that constructor
  `fromIterable` — so the call fails outright. `isArray` and `of` do exist there and are the
  dangerous half: `of` takes exactly one element and returns a non-empty array where the global is
  variadic, so the call keeps working and quietly builds something else. All three have to be
  reached through `globalThis.Array` in such a file.
- Two import spellings bind an Effect module under its own name — the barrel's named export and the
  leaf namespace import — and only the specifier's local name decides whether a global of that name
  is shadowed (measured: both unaliased spellings suppress a name-keyed rule, the aliased form does
  not).
- An upstream rule that recognises only the barrel import form is dead code in a codebase that bans
  barrels; porting one requires teaching it the leaf namespace form.
- Every direct _read_ of Effect's private discriminant is either a hand-rolled match a new variant
  falls through, or a guard the library already provides. Defining a tag is legitimate: property
  keys in a class or object, a plain assignment in a hand-rolled tagged class, and type positions.
  A compound assignment reads before it writes and so counts as a read.
- Reading a discriminant can be spelled as dotted access, bracket access with a string literal, or a
  destructuring pattern with a rename in front of it; all three are the same read. Bracket access
  through a variable is unresolvable by syntax-only analysis and rare enough to leave to review.
- A recovery handler whose entire body is Effect's do-nothing value deletes the failure: the error
  reaches no log, no fallback and no caller error channel, and the program continues as if nothing
  happened. Any second statement, or any other return value such as a success or a logged error,
  indicates deliberate recovery. The handler-taking combinators concerned are `catch`, `catchTag`,
  `catchTags`, `catchReason` and `catchReasons`. Both the current spelling `void` and the pre-v4
  `unit` are matched, though the pinned Effect exports only the former (measured) — a file carried
  over from an older Effect still trips the ban rather than passing on a name that no longer
  resolves.
- `Effect.asVoid` on an effect that already succeeds with void is noise, and on one that does not it
  discards a value somebody wanted. Banning it by member reference catches uses inside a pipe and
  deliberately misses aliased module imports.
- `disableValidation: true` turns a schema decode into a cast: the schema still describes the shape
  and nothing checks the data against it. The gap belongs fixed in the data or the schema. Only a
  literal `true` is a violation — `false`, a variable or shorthand are not.
- Two provisioning stages in one pipe hide the dependency graph: whether the second layer feeds the
  first or the two are independent is invisible at the call site, and the order is load-bearing
  either way. Independent dependencies go in a single provide call; a layer depending on another
  should be extracted and named first. Only pipe arguments are checked, not method chaining, because
  that is the shape the fix applies to.
- A row-typed SQL tagged template asserts the row shape instead of proving it: the type argument is
  erased at runtime, so nothing checks the database ever returns it. Only a typed query API or a
  schema decoded at the boundary actually checks it.

## What is banned, and why

- **Assertions to `any`, `never` or `unknown`** erase the type instead of describing it, so every
  downstream check is decided by the assertion rather than the code. `satisfies`, `as const` and
  assertions to named types stay untouched. Consequence of banning only those three keywords: in
  `x as unknown as Foo` the inner assertion reports and the outer one, whose annotation is a type
  reference, stays silent.
- **Chained assertions** launder one type into another by way of a type that means nothing, leaving
  the checker no evidence to disagree with. The fix is the precise type, or parsing untrusted input
  at its boundary. A chain made entirely of const assertions narrows rather than overrides and is
  left alone.
- **A const assertion is the one assertion that adds evidence**, so every assertion-policing rule
  exempts it — and each must visit both the `as` and angle-bracket spellings.
- **Spreading a conditional whose other branch is `{}`** omits a property by spreading nothing, so
  whether the key exists is invisible where the object is read. Build the object in steps. Only
  spreads into an object literal matter; the same spread into an array or a call omits nothing.
- **`'key' in value` as a type probe** stands in for a type the code failed to carry; the fix is to
  widen the type where the value is produced. Predicate helpers are a last-resort escape hatch, not
  the default replacement.
- **Widening a value of known shape.** A value written inline — object literal, array, function,
  `new` — already carries its shape. Annotating what it flows into with something broad throws that
  shape away at the one place it was free, and every reader downstream pays. Keep inference, check
  with `satisfies`, or name the contract; an interface or non-index object alias _is_ the fix, and
  neither `satisfies` nor `as const` widens.
- **Accumulator exception:** an _empty_ object literal flowing into an open dictionary or generic
  container declares an empty map rather than discarding a shape, and must be exempt. A populated
  literal in the same position still discards a shape.
- **A parameter typed `unknown`** accepts anything and parses nothing: the caller's value arrives
  unchecked and every use re-establishes what it is. Parse at the I/O boundary and take the named
  domain type. A parameter named exactly `cause` is the accepted escape hatch, since error
  enrichment takes whatever the runtime threw and cannot parse it.
- **A return contract of `unknown`** hands the caller a value it cannot use without the parsing the
  function itself skipped. It counts wherever it reaches the top level of the contract: directly,
  through parentheses, as any union member, inside a promise type, or through a top-level
  non-generic alias resolved recursively. Nested inside an object type it is a field, not the
  contract, and is left alone.
- **The parameter ban is deliberately narrower than the return ban:** in parameter position only the
  literal keyword written on the parameter is flagged, leaving aliases resolving to it, arrays of
  it, promises of it and unions containing it alone.
- **A type alias for `unknown`** reads as a type while carrying none — every value inhabits it, so
  the alias is a label the compiler never checks. Spell it out at the parsing boundary or on a
  `cause` field. A union merely _containing_ it is a separate case, left alone: the union has other
  members, so that is a widening bug rather than a disguise.
- **`switch`** is hand-rolled dispatch that a newly added variant falls through silently; the
  matching combinators are the checked form that fails to compile when a variant is unhandled.
- **`try`** moves failure out of the type system: nothing records what was thrown, so nothing can
  check the handler still covers it. This holds for `try`/`finally` with no catch clause too — the
  body still throws into an untyped channel.
- **A hand-written match spelled as chained ternaries** is the same defect as a switch. Detection
  follows the alternate branch only (a ternary nested in the consequent is a different shape), every
  link must compare the same subject by source text, and a link that does not aborts the whole chain
  rather than reporting a shorter prefix. Two literal comparisons is the minimum that counts.
- **A hand-written nullable ternary producing an optional value** drops the undefined case that the
  library's from-nullable constructor handles — that, not brevity, is the substantive reason to
  prefer the constructor. Loose inequality against null counts, since against null it performs
  exactly the nullish test.
- Also banned, each with its stated reason: **module mocking** (proves the mock's behaviour, not the
  real seam — inject the dependency); **nested Effect array method calls** (the inner call's element
  type becomes the outer call's inference input, so one loose annotation degrades everything above
  it — pipe feeds each stage a settled type); **a parameter typed `object`** (accepts every
  non-primitive and describes none, so nothing can be read off it without an assertion); **optional
  parameters** (three caller states hidden behind punctuation — spell the undefined union out);
  **re-export-only modules** (own nothing, hide the owning module, and give import cycles somewhere
  to live); **reflective apply** (invokes through an untyped argument array, so arity and parameter
  types go unchecked); **reflective property get** (result is `any`, so every downstream use is
  unchecked); **runtime `typeof` checks** (assert a representation, never a contract — decode at the
  I/O boundary and branch on the domain value); and **the combinator that turns a missing service
  into a runtime option** (hides the wiring gap the layer should have failed on).

## Comments, spacing and autofixes

- A comment ban must exempt comments whose trimmed text starts with `SAFETY:`, because the companion
  rule demands exactly such a comment on every non-const assertion; without the carve-out the two
  cannot both be satisfied. The exemption is anchored at the start, so a `SAFETY:` buried mid-
  sentence stays prose.
- The ban exempts the shebang and the compiler, coverage and lint directive prefixes, since those
  change what a tool does. JSDoc is not exempt. Declaration files and files marked generated are
  skipped whole: neither their contents nor their comments are the author's writing.
- A justification comment for an assertion may sit directly above the assertion or above the
  statement containing it, so the search walks upward and stops at the first comment-owning
  statement kind (expression, property definition, return, throw, variable declaration) or at the
  top level, checking that level before stopping. A trailing comment justifies nothing: the comment
  must end before the assertion begins.
- A run of consecutive assertion statements is one block: a blank line above and below the run, none
  inside it. Gaps where neither neighbour is an assertion are deliberately left to the general
  vertical-spacing rules rather than duplicated.
- A fixer that closes the blank line between two statements will silently delete a standalone
  comment sitting in that gap. Treat a comment on its own line as content, not spacing, and exempt
  the gap. A comment trailing on the same line as the earlier statement is part of that line, so the
  gap below it still closes.
- Replacing the whole range between two statements with a single newline plus the target indentation
  collapses several consecutive blank lines in one pass, where deleting one newline at a time needs
  repeated fix rounds. The replaced range must start after any trailing comment on the earlier line.
- A comment directly above a statement introduces it, so a required blank line belongs above the
  comment, not between comment and statement — and the gap must be measured _to_ the comment,
  because a comment line is not a blank line yet still raises the following node's start line.
- An autofix inserting a blank line above a statement must target the start of that statement's
  line (node start offset minus its column), not the position immediately before the node. Inserting
  before the node lands after the indentation and strands it on the new blank line.
- The vertical-spacing config shape of `{ blankLine, prev, next }` entries where the _last_ matching
  entry wins is what lets broad "always" rules lead and narrow exceptions trail. Restricting the
  port to the values actually written in practice, and making unknown statement types fail to decode
  rather than silently match nothing, turns config typos into loud errors.
- Classifying "block-like" statements structurally (statements owning a block, an immediately
  invoked block expression, or a declaration whose initializer is a block-bodied function) agrees
  with the original token-walk classification on everything a real spec covers (measured), and
  avoids last-token and range-index lookups the plugin API does not offer.
- A fixed top-level ordering rule leaves class declarations unranked: values built from class-based
  constructors are consumed by the constants that follow them, so forcing classes last produces a
  temporal-dead-zone error. Type aliases containing a `typeof` query are likewise unranked, so a
  schema's derived type stays beside its schema constant.
- A running maximum built with a scan seeded by an initial value gives, at each index, the maximum
  over everything strictly before it — exactly what an ordering check wants. A violating element
  ranks below that maximum by definition, so it never advances the accumulator and needs no special
  case.

## Rule design

- The linter interpolates `{{key}}` placeholders from a diagnostic's data payload whenever the
  diagnostic is raised by message id (measured). Building the message by hand with a string replace
  is therefore never necessary, and doing it costs the rule its message-id entry — which is the only
  place a message is declared, and so the only thing a reader can find. Raise by id, pass the values
  as data, and let the linter render.
- Rules ship report-only, with no autofix, whenever the correct fix needs knowledge the rule does
  not have: the precise replacement type, the owner type behind a broad parameter, the schema a
  value should have been parsed with, whether an absent value means undefined or null, the intended
  dependency ordering, which keys an object should end up with, which argument of a nested call is
  the pipe subject, which match combinator fits, the invariant behind an assertion, or whether a
  comment says something worth moving rather than deleting. Reporting without fixing is the design
  there, not an omission.
- When a rule walks an assertion chain it anchors at exactly one end — outermost or innermost — so a
  chain yields one diagnostic however long it is. Two rules covering different complaints may pick
  opposite ends: the chained-assertion complaint reports the outermost, while the widening complaint
  reports the innermost, because an outer assertion widening an assertion is the other rule's
  business.
- Detecting "widen a value then assert it back" safely requires syntactic evidence the author
  already had the precise type: a literal, object, array, function or class expression, a prior
  precise assertion, or an annotated binding it was copied from. A call result carries no such
  evidence and must be left alone rather than guessed at. The widening and the assertion must share
  an enclosing function, with the assertion textually second, or it is two authors rather than one
  round trip.
- A template literal with no interpolations is as constant as a plain literal and is treated as one
  by anything looking for literal comparisons. When literals appear on both sides of a comparison,
  taking the left one as the constant means it is the right-hand text that must stay identical down
  a chain.
- Several rules match purely syntactically on a namespace binding's member: any receiver with that
  name counts, imported or not, and an aliased import is deliberately not caught. Only the rules
  gated on the Effect array import check whether the file actually bound the module unaliased, since
  there the binding shadows a global of the same name.
- Recognising a library by the module identifier used at the call site, with no import check, is a
  deliberate simplicity trade: purely syntactic, at the cost of missing aliased imports.
- Module mocking is detected by the _imported_ name rather than the local binding, so an aliased
  import is still caught. Coverage is the two mainstream runners (`mock`, `doMock`,
  `unstable_mockModule`) plus Bun's `mock.module` only — a bare `mock()` under Bun wraps a function
  and stays legal, since only the member call rewires an import. A name the scope manager cannot
  resolve, or resolves to a variable with no definitions, is treated as the runner's injected
  global, which is how those globals are normally written; ambient declarations land in the same
  bucket. Upstream rules knowing only the two mainstream runners can never fire in a Bun-only repo,
  which is why Bun support had to be added when porting them.
- The re-export-only ban exempts framework route files, because a router resolving a file by path
  needs it to exist whatever is inside it. The exemption is two configurable halves that must both
  hold — the directory names marking a route tree, and the filenames exempt inside one — so a file
  with an exempt name outside a route tree is still an ordinary module. The defaults cover
  app-router files whose only job is to re-export a component.
- A size limit such as a maximum pipeline length is deliberately not configurable: one number
  applied everywhere is what makes the limit reviewable, since a per-project knob just gets raised.
- When porting a rule, a message naming a fix the reader cannot reach — a library the consumer does
  not depend on — is worse than a general one. Rewrite it to point at what is actually to hand.
- Landing a rule and switching it on are separable steps, because every rule is tested against a
  config generated for it alone: a rule can ship fully tested while the shipped preset still leaves
  it off, and be enabled once the code it would have failed is cleaned up. Both rules that needed
  that staging — the comment ban, held back until the comments in the codebase had moved into a
  decision log, and the runtime-`typeof` ban, held back while genuine checks remained — are now on.
  The preset consequently enables every rule the plugin defines except the one governing spacing
  between assertions, which an override scopes to test files instead of the whole tree.

## Testing approach

- Rules are tested through the real linter binary rather than a unit-level rule tester, which is the
  only way to cover the JS-plugin bridge as well as the rule logic — a rule can be correct in
  isolation and still never load. It is also the only option for a consumer on TypeScript 7, since
  typescript-eslint refuses to load against it and ESLint's rule tester is therefore unavailable.
- Every rule is tested twice: against a fixture that must be reported, at named line numbers, and
  against a clean twin that must report nothing. Asserting the exact lines rather than "something was
  reported" is what makes the first half mean anything, since a rule that fires indiscriminately
  satisfies a mere non-empty check just as well.
- A clean twin earns its place only by holding the near misses — the shapes that resemble the
  violation and must not be reported. One that merely omits the pattern passes just as happily with
  the rule deleted, which makes it a test of nothing. Aliased imports, same-named members on other
  receivers, locally shadowed bindings, the inverted or one-short form of the pattern, and the
  legitimate spelling the rule is steering people toward are the cases worth writing down.
- The rejecting fixtures are deliberately malformed source, so each must be linted with only its own
  rule enabled or they trip each other's rules. They are also excluded from the linter and the
  formatter, since formatting them would repair the violations and turn those tests green against
  nothing. Naming one rule in a generated config does not turn the linter's default correctness
  rules off, though, so the harness filters the report down to the plugin's own diagnostic code: the
  unused-variable rule fires on any fixture that binds a name, and most of them do (measured).
- Decoding the linter's JSON report through a schema instead of narrowing it by hand makes a change
  in the output format surface as a decode failure naming the missing field, rather than as
  undefined line numbers in an assertion diff.
- That decode also catches a rule that crashes at runtime, which matters more than the format
  argument. A plugin rule throwing mid-walk is reported as a diagnostic carrying a message but no
  rule code (measured), and the harness keeps only diagnostics whose code matches the rule under
  test — so a crashed rule would otherwise contribute nothing to the filtered list and let its clean
  fixture pass for the wrong reason. Requiring the code field makes the crash a decode failure
  instead. Reporting a message id the rule's metadata does not declare is one way to produce exactly
  that shape.
- Generating the passing half of the suite by scanning the clean-fixture directory is not by itself
  a guard, and was mistaken for one: a rule whose clean twin is deleted simply stops having that
  test, and the suite shrinks in silence. What actually holds is a check that reconciles three sets —
  the rule names the plugin itself defines, the rules with a rejecting case, and the clean fixtures
  on disk — and fails when any of them disagree. Taking the rule names from the plugin rather than
  from a list written beside the tests is the part that cannot drift, since adding a rule is what
  makes the check notice it.
- Duplicate line numbers in an expected-line list are legitimate: a rule reporting per offending
  item reports twice on one line holding two offenders — two optional parameters, two silent error
  handlers in one call, or two chained calls beginning on the same line.
