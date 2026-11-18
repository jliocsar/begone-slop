# begone-slop

Oxlint rules that reject low-evidence TypeScript and non-idiomatic Effect.

Most lint rules police style. These police _evidence_: they fire when code claims to know something
it never established — a value asserted rather than parsed, a `typeof` check standing in for a
contract, an `unknown` widened and then narrowed back by hand. The Effect rules cover the v4 APIs
that are easy to reach for and hard to walk back.

## Install

```sh
npm i -D @jliocsar/begone-slop oxlint
```

## Use

```ts
// oxlint.config.ts
import { defineConfig } from 'oxlint'
import preset from '@jliocsar/begone-slop/preset.json' with { type: 'json' }

export default defineConfig({
  extends: [preset],
  jsPlugins: ['@jliocsar/begone-slop'],
})
```

That is the whole setup. `extends` pulls in the 53 rules the preset enables, and `jsPlugins` loads
the plugin itself. Both resolve as ordinary module specifiers, because in a TypeScript config
`extends` takes config _objects_ and your runtime does the resolving.

This file is discovered automatically, but something has to import TypeScript to read it. Node 22.18
or newer can. Node 20 cannot, whatever oxlint's own error message claims about it — measured on
20.19.4, where the flag it would need is not even a recognised option. Running oxlint under Bun
works on any of them:

```sh
bunx --bun oxlint
```

If neither suits you, the JSON config below has no runtime requirement at all.

### The JSON config

```jsonc
// .oxlintrc.json
{
  "extends": ["./node_modules/@jliocsar/begone-slop/preset.json"],
  "jsPlugins": ["@jliocsar/begone-slop"],
}
```

Equivalent, and loaded by any runtime. The one wart: **`extends` here does not take a package
specifier.** It resolves relative to the config file, so `"@jliocsar/begone-slop/preset.json"` would
silently mean `./@jliocsar/begone-slop/preset.json` and fail — hence the explicit path. `jsPlugins`
has no such limitation. Both behaviours are measured.

### The package is scoped, the rules are not

The package installs as `@jliocsar/begone-slop`, but every rule is named `begone-slop/…` — a plugin
declares its own name independently of the package that ships it. So you reference the scope when
installing and loading, and never again after that.

Prefer to pick your own rules? Skip `extends` and enable them by name:

```jsonc
{
  "jsPlugins": ["@jliocsar/begone-slop"],
  "rules": {
    "begone-slop/no-tag-access": "error",
    "begone-slop/require-safety-comment-for-type-assertion": "error",
  },
}
```

### The preset turns oxlint's defaults off

`preset.json` sets `"plugins": ["typescript"]` and nothing more. Extending a preset otherwise
re-enables oxlint's own default plugin set on top of your config, which fails the build on rules
nobody chose. If you want `unicorn`, `oxc` or the rest, list them yourself in your own `plugins`
array — it takes precedence, since later config wins.

The `typescript` entry is there for `ban-ts-comment` below. With an empty list in the preset, a
consumer whose own `plugins` leaves `typescript` out gets that rule switched off without a word
(measured on oxlint 1.91.0).

Three of oxlint's own rules are on:

- `curly: ["error", "all"]`: every `if`, `else`, `for` and `while` body takes braces. It autofixes.
- `max-depth: ["error", 4]`: no block nested more than four deep.
- `typescript/ban-ts-comment` at its defaults: no `@ts-ignore` or `@ts-nocheck`, and a
  `@ts-expect-error` has to say why.

## Rules

`✅` marks the rules the preset enables. `expect-padding` is off by default because it only makes
sense scoped to test files:

```jsonc
{
  "overrides": [{ "files": ["**/*.test.ts"], "rules": { "begone-slop/expect-padding": "error" } }],
}
```

`Source` links the file each rule was borrowed from, and `—` means it started here. The projects
themselves are under [Prior art](#prior-art).

### Evidence and type safety

| Rule                                        | What it rejects                                          | Source                                                 | Preset |
| ------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------ | :----: |
| `no-banned-type-assertions`                 | assertions to `any`, `never` or `unknown`                | [ai-automation][no-banned-type-assertions]             |   ✅   |
| `no-chained-type-assertions`                | chained assertions, `x as unknown as T` included         | [anti-slop][no-chained-type-assertions]                |   ✅   |
| `no-widen-then-assert`                      | asserting a widened `const` back to a narrower type      | [anti-slop][no-widen-then-assert]                      |   ✅   |
| `no-known-value-widening`                   | widening a value of known shape into a broad annotation  | [anti-slop][no-known-value-widening]                   |   ✅   |
| `require-safety-comment-for-type-assertion` | any assertion without a `SAFETY:` comment                | [anti-slop][require-safety-comment-for-type-assertion] |   ✅   |
| `no-unknown-parameters`                     | parameters annotated `unknown`, except one named `cause` | [anti-slop][no-unknown-parameters]                     |   ✅   |
| `no-unknown-returns`                        | functions whose return contract resolves to `unknown`    | [anti-slop][no-unknown-returns]                        |   ✅   |
| `no-unknown-type-aliases`                   | type aliases that resolve to `unknown`                   | [anti-slop][no-unknown-type-aliases]                   |   ✅   |
| `no-unsafe-dictionary-type`                 | dictionary types whose value type is an escape hatch     | [anti-slop][no-unsafe-dictionary-type]                 |   ✅   |
| `no-object-parameters`                      | parameters typed `object`, aliases included              | [anti-slop][no-object-parameters]                      |   ✅   |
| `no-runtime-typeof`                         | `typeof` checks on values that were never parsed         | [anti-slop][no-runtime-typeof]                         |   ✅   |
| `no-in-operator`                            | the `in` operator used as an object-key probe            | [ai-automation][no-in-operator]                        |   ✅   |
| `no-reflect-get`                            | `Reflect.get` in favour of typed property access         | [anti-slop][no-reflect-get]                            |   ✅   |
| `no-reflect-apply`                          | `Reflect.apply` in favour of a typed call                | [anti-slop][no-reflect-apply]                          |   ✅   |
| `no-optional-function-parameters`           | optional parameters in favour of an explicit union       | [ai-automation][no-optional-function-parameters]       |   ✅   |
| `no-disabled-type-assertion-rules`          | inline disables of the assertion rules, or of every rule | [K-Mistele's fork][no-disabled-type-assertion-rules]   |   ✅   |

[no-banned-type-assertions]: https://github.com/typeonce-dev/ai-automation/blob/0bca096fe6fe9878cd15303a623dd2cd85915ddd/rules/oxlint/src/rules/no-banned-type-assertions.ts
[no-chained-type-assertions]: https://github.com/dmmulroy/anti-slop/blob/13909c9e07590f5a85d93c62712259fe14a883f7/src/rules/no-chained-type-assertions.ts
[no-widen-then-assert]: https://github.com/dmmulroy/anti-slop/blob/13909c9e07590f5a85d93c62712259fe14a883f7/src/rules/no-widen-then-assert.ts
[no-known-value-widening]: https://github.com/dmmulroy/anti-slop/blob/13909c9e07590f5a85d93c62712259fe14a883f7/src/rules/no-known-value-widening.ts
[require-safety-comment-for-type-assertion]: https://github.com/dmmulroy/anti-slop/blob/13909c9e07590f5a85d93c62712259fe14a883f7/src/rules/require-safety-comment-for-type-assertion.ts
[no-unknown-parameters]: https://github.com/dmmulroy/anti-slop/blob/13909c9e07590f5a85d93c62712259fe14a883f7/src/rules/no-unknown-parameters.ts
[no-unknown-returns]: https://github.com/dmmulroy/anti-slop/blob/13909c9e07590f5a85d93c62712259fe14a883f7/src/rules/no-unknown-returns.ts
[no-unknown-type-aliases]: https://github.com/dmmulroy/anti-slop/blob/13909c9e07590f5a85d93c62712259fe14a883f7/src/rules/no-unknown-type-aliases.ts
[no-unsafe-dictionary-type]: https://github.com/dmmulroy/anti-slop/blob/13909c9e07590f5a85d93c62712259fe14a883f7/src/rules/no-unsafe-dictionary-type.ts
[no-object-parameters]: https://github.com/dmmulroy/anti-slop/blob/13909c9e07590f5a85d93c62712259fe14a883f7/src/rules/no-object-parameters.ts
[no-runtime-typeof]: https://github.com/dmmulroy/anti-slop/blob/13909c9e07590f5a85d93c62712259fe14a883f7/src/rules/no-runtime-typeof.ts
[no-in-operator]: https://github.com/typeonce-dev/ai-automation/blob/0bca096fe6fe9878cd15303a623dd2cd85915ddd/rules/oxlint/src/rules/no-in-operator.ts
[no-reflect-get]: https://github.com/dmmulroy/anti-slop/blob/13909c9e07590f5a85d93c62712259fe14a883f7/src/rules/no-reflect-get.ts
[no-reflect-apply]: https://github.com/dmmulroy/anti-slop/blob/13909c9e07590f5a85d93c62712259fe14a883f7/src/rules/no-reflect-apply.ts
[no-optional-function-parameters]: https://github.com/typeonce-dev/ai-automation/blob/0bca096fe6fe9878cd15303a623dd2cd85915ddd/rules/oxlint/src/rules/no-optional-function-parameters.ts
[no-disabled-type-assertion-rules]: https://github.com/k-mistele/anti-slop/blob/3944fc34ea7923ed8354df313474633ec73e6488/src/rules/no-disabled-type-assertion-rules.ts

### Effect

| Rule                                | What it rejects                                                      | Source                                                                           | Preset |
| ----------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------------------- | :----: |
| `no-tag-access`                     | reading the `_tag` discriminant directly, which skips exhaustiveness | —                                                                                |   ✅   |
| `no-shadowed-error-field`           | a `name`/`stack` field that stops an error identifying itself        | —                                                                                |   ✅   |
| `no-silent-error-swallow`           | a catch returning a void effect; `Effect.ignore` with no log         | [ai-automation][no-silent-error-swallow]                                         |   ✅   |
| `no-disable-validation`             | `disableChecks: true` (v3: `disableValidation`), unchecked           | [ai-automation][no-disable-validation]                                           |   ✅   |
| `no-service-option`                 | `Effect.serviceOption` instead of requiring the service              | [ai-automation][no-service-option]                                               |   ✅   |
| `no-effect-asvoid`                  | every `Effect.asVoid`, since a lint rule can't see the type          | [ai-automation][no-effect-asvoid]                                                |   ✅   |
| `no-nested-layer-provide`           | nested `Layer.provide` calls                                         | [ai-automation][no-nested-layer-provide]                                         |   ✅   |
| `no-cascading-layer-provide`        | multiple `Layer.provide` stages in one pipe                          | [ai-automation][no-cascading-layer-provide]                                      |   ✅   |
| `no-service-layer-provide`          | a service's static layer providing its own dependencies              | —                                                                                |   ✅   |
| `no-nested-effect-array-methods`    | one `effect/Array` call nested inside another                        | [ai-automation][no-nested-effect-array-methods]                                  |   ✅   |
| `no-shadowed-standard-array-static` | standard `Array` statics when `Array` is Effect's                    | [ai-automation][no-shadowed-standard-array-static]                               |   ✅   |
| `prefer-option-from-nullable`       | a nullish ternary that restates `Option.fromNullishOr` & co.         | [ai-automation][prefer-option-from-nullable]                                     |   ✅   |
| `prefer-effect-match`               | chained literal ternaries over one subject                           | [ai-automation][prefer-effect-match], [anti-slop][anti-slop-prefer-effect-match] |   ✅   |
| `pipe-max-arguments`                | a `.pipe()` call with more than 20 arguments                         | [ai-automation][pipe-max-arguments]                                              |   ✅   |
| `no-sql-type-parameter`             | `sql<Type>` templates that assert a row shape                        | [ai-automation][no-sql-type-parameter]                                           |   ✅   |
| `require-cause-when-narrowing`      | a handler that replaces an error it never read, without a `cause`    | [K-Mistele's fork][require-cause-when-narrowing]                                 |   ✅   |
| `no-manual-tagged-construction`     | hand-written `{ _tag: 'X' }` literals and `_tag` class fields        | [K-Mistele's fork][no-manual-tagged-construction]                                |   ✅   |
| `prefer-tagged-error-handling`      | `Predicate.isTagged` inside a broad catch                            | [K-Mistele's fork][prefer-tagged-error-handling]                                 |   ✅   |
| `prefer-yield-service`              | `yield* Effect.context()` provided straight back                     | [K-Mistele's fork][prefer-yield-service]                                         |   ✅   |
| `no-reprovide-ambient-service`      | `Effect.provideService` with a service just yielded from the context | [K-Mistele's fork][no-reprovide-ambient-service]                                 |   ✅   |
| `no-service-parameters`             | parameters typed `Context.Context`, `Layer.Layer`, `ManagedRuntime`  | [K-Mistele's fork][no-service-parameters]                                        |   ✅   |
| `require-service-make-layer`        | a `Context.Service` with a `make` and no `static layer`              | [K-Mistele's fork][require-service-make-layer]                                   |   ✅   |
| `require-operation-span`            | a service operation without `Effect.fn('name')` or `withSpan`        | [K-Mistele's fork][require-operation-span]                                       |   ✅   |

[no-silent-error-swallow]: https://github.com/typeonce-dev/ai-automation/blob/0bca096fe6fe9878cd15303a623dd2cd85915ddd/rules/oxlint/src/rules/no-silent-error-swallow.ts
[no-disable-validation]: https://github.com/typeonce-dev/ai-automation/blob/0bca096fe6fe9878cd15303a623dd2cd85915ddd/rules/oxlint/src/rules/no-disable-validation.ts
[no-service-option]: https://github.com/typeonce-dev/ai-automation/blob/0bca096fe6fe9878cd15303a623dd2cd85915ddd/rules/oxlint/src/rules/no-service-option.ts
[no-effect-asvoid]: https://github.com/typeonce-dev/ai-automation/blob/0bca096fe6fe9878cd15303a623dd2cd85915ddd/rules/oxlint/src/rules/no-effect-asvoid.ts
[no-nested-layer-provide]: https://github.com/typeonce-dev/ai-automation/blob/0bca096fe6fe9878cd15303a623dd2cd85915ddd/rules/oxlint/src/rules/no-nested-layer-provide.ts
[no-cascading-layer-provide]: https://github.com/typeonce-dev/ai-automation/blob/0bca096fe6fe9878cd15303a623dd2cd85915ddd/rules/oxlint/src/rules/no-cascading-layer-provide.ts
[no-nested-effect-array-methods]: https://github.com/typeonce-dev/ai-automation/blob/0bca096fe6fe9878cd15303a623dd2cd85915ddd/rules/oxlint/src/rules/no-nested-effect-array-methods.ts
[no-shadowed-standard-array-static]: https://github.com/typeonce-dev/ai-automation/blob/0bca096fe6fe9878cd15303a623dd2cd85915ddd/rules/oxlint/src/rules/no-shadowed-standard-array-static.ts
[prefer-option-from-nullable]: https://github.com/typeonce-dev/ai-automation/blob/0bca096fe6fe9878cd15303a623dd2cd85915ddd/rules/oxlint/src/rules/prefer-option-from-nullable.ts
[prefer-effect-match]: https://github.com/typeonce-dev/ai-automation/blob/0bca096fe6fe9878cd15303a623dd2cd85915ddd/rules/oxlint/src/rules/prefer-effect-match.ts
[anti-slop-prefer-effect-match]: https://github.com/dmmulroy/anti-slop/blob/13909c9e07590f5a85d93c62712259fe14a883f7/src/effect/rules/prefer-effect-match.ts
[pipe-max-arguments]: https://github.com/typeonce-dev/ai-automation/blob/0bca096fe6fe9878cd15303a623dd2cd85915ddd/rules/oxlint/src/rules/pipe-max-arguments.ts
[no-sql-type-parameter]: https://github.com/typeonce-dev/ai-automation/blob/0bca096fe6fe9878cd15303a623dd2cd85915ddd/rules/oxlint/src/rules/no-sql-type-parameter.ts
[require-cause-when-narrowing]: https://github.com/k-mistele/anti-slop/blob/3944fc34ea7923ed8354df313474633ec73e6488/src/effect/rules/require-cause-when-narrowing.ts
[no-manual-tagged-construction]: https://github.com/k-mistele/anti-slop/blob/3944fc34ea7923ed8354df313474633ec73e6488/src/effect/rules/no-manual-tagged-construction.ts
[prefer-tagged-error-handling]: https://github.com/k-mistele/anti-slop/blob/3944fc34ea7923ed8354df313474633ec73e6488/src/effect/rules/prefer-tagged-error-handling.ts
[prefer-yield-service]: https://github.com/k-mistele/anti-slop/blob/3944fc34ea7923ed8354df313474633ec73e6488/src/effect/rules/prefer-yield-service.ts
[no-reprovide-ambient-service]: https://github.com/k-mistele/anti-slop/blob/3944fc34ea7923ed8354df313474633ec73e6488/src/rules/no-reprovide-ambient-service.ts
[no-service-parameters]: https://github.com/k-mistele/anti-slop/blob/3944fc34ea7923ed8354df313474633ec73e6488/src/effect/rules/no-service-parameters.ts
[require-service-make-layer]: https://github.com/k-mistele/anti-slop/blob/3944fc34ea7923ed8354df313474633ec73e6488/src/effect/rules/require-service-make-layer.ts
[require-operation-span]: https://github.com/k-mistele/anti-slop/blob/3944fc34ea7923ed8354df313474633ec73e6488/src/effect/rules/require-operation-span.ts

### Structure and style

| Rule                                 | What it rejects                                           | Source                                                                 | Preset |
| ------------------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------- | :----: |
| `no-comments`                        | every comment but `SAFETY:` and tooling directives        | [ai-automation][no-comments], [landmines][landmines-no-comments]       |   ✅   |
| `no-switch`                          | `switch` statements, in favour of `Match`                 | [ai-automation][no-switch], [landmines][landmines-allowlist]           |   ✅   |
| `no-try-catch`                       | `try`/`catch`, in favour of `Effect.try`                  | [ai-automation][no-try-catch], [landmines][landmines-allowlist]        |   ✅   |
| `no-module-mocking`                  | module mocking, stubbed globals and scripted spies        | [anti-slop][no-module-mocking], [landmines][landmines-no-test-doubles] |   ✅   |
| `no-test-code-in-src`                | test files, test imports and test-named exports in `src/` | [K-Mistele's fork][no-test-code-in-src]                                |   ✅   |
| `no-reexport-only-modules`           | barrel modules that only re-export                        | [ai-automation][no-reexport-only-modules]                              |   ✅   |
| `no-conditional-empty-object-spread` | omitting a field by spreading `{}`                        | [anti-slop][no-conditional-empty-object-spread]                        |   ✅   |
| `statement-order`                    | top-level declarations out of order                       | —                                                                      |   ✅   |
| `padding-line-between-statements`    | missing or extra blank lines, per a declarative spec      | —                                                                      |   ✅   |
| `max-ternary-depth`                  | ternaries nested deeper than two levels                   | [K-Mistele's fork][max-ternary-depth]                                  |   ✅   |
| `no-array-filter-map`                | a `filter` and a `map` back to back on a known array      | [K-Mistele's fork][no-array-filter-map]                                |   ✅   |
| `no-reduce-accumulator-copy`         | a reduce that copies its accumulator on every step        | [K-Mistele's fork][no-reduce-accumulator-copy]                         |   ✅   |
| `no-fixed-sleep`                     | an awaited fixed sleep inside a test or hook              | [landmines][no-fixed-sleep]                                            |   ✅   |
| `no-flake-masking`                   | test retries and raised test timeouts                     | [landmines][no-flake-masking]                                          |   ✅   |
| `expect-padding`                     | a run of `expect()` calls not isolated by blank lines     | —                                                                      |   —    |

[no-comments]: https://github.com/typeonce-dev/ai-automation/blob/0bca096fe6fe9878cd15303a623dd2cd85915ddd/rules/oxlint/src/rules/no-comments.ts
[landmines-no-comments]: https://github.com/interfere-inc/landmines/blob/92084b12872103b0f9245c0325ab571df00a574b/packages/landmines/src/rules/no-comments.ts
[no-switch]: https://github.com/typeonce-dev/ai-automation/blob/0bca096fe6fe9878cd15303a623dd2cd85915ddd/rules/oxlint/src/rules/no-switch.ts
[landmines-allowlist]: https://github.com/interfere-inc/landmines/blob/92084b12872103b0f9245c0325ab571df00a574b/packages/landmines/src/lib/allowlist.ts
[no-try-catch]: https://github.com/typeonce-dev/ai-automation/blob/0bca096fe6fe9878cd15303a623dd2cd85915ddd/rules/oxlint/src/rules/no-try-catch.ts
[no-module-mocking]: https://github.com/dmmulroy/anti-slop/blob/13909c9e07590f5a85d93c62712259fe14a883f7/src/rules/no-module-mocking.ts
[landmines-no-test-doubles]: https://github.com/interfere-inc/landmines/blob/92084b12872103b0f9245c0325ab571df00a574b/packages/landmines/src/rules/no-test-doubles.ts
[no-test-code-in-src]: https://github.com/k-mistele/anti-slop/blob/3944fc34ea7923ed8354df313474633ec73e6488/src/effect/rules/no-test-code-in-src.ts
[no-reexport-only-modules]: https://github.com/typeonce-dev/ai-automation/blob/0bca096fe6fe9878cd15303a623dd2cd85915ddd/rules/oxlint/src/rules/no-reexport-only-modules.ts
[no-conditional-empty-object-spread]: https://github.com/dmmulroy/anti-slop/blob/13909c9e07590f5a85d93c62712259fe14a883f7/src/rules/no-conditional-empty-object-spread.ts
[max-ternary-depth]: https://github.com/k-mistele/anti-slop/blob/3944fc34ea7923ed8354df313474633ec73e6488/src/rules/max-ternary-depth.ts
[no-array-filter-map]: https://github.com/k-mistele/anti-slop/blob/3944fc34ea7923ed8354df313474633ec73e6488/src/rules/no-array-filter-map.ts
[no-reduce-accumulator-copy]: https://github.com/k-mistele/anti-slop/blob/3944fc34ea7923ed8354df313474633ec73e6488/src/rules/no-reduce-accumulator-copy.ts
[no-fixed-sleep]: https://github.com/interfere-inc/landmines/blob/92084b12872103b0f9245c0325ab571df00a574b/packages/landmines/src/rules/no-fixed-sleep.ts
[no-flake-masking]: https://github.com/interfere-inc/landmines/blob/92084b12872103b0f9245c0325ab571df00a574b/packages/landmines/src/rules/no-flake-masking.ts

`no-disabled-type-assertion-rules` reads `oxlint-disable` and `eslint-disable` comments. It reports
the ones that name an assertion rule (begone-slop's own, itself included, plus
`typescript/consistent-type-assertions`, `typescript/no-unsafe-type-assertion`,
`typescript/no-non-null-assertion` and `effecttsgo/unsafe-effect-type-assertion`) and the ones that
name no rule at all. Add your own with `{ "additionalRules": ["…"] }`. One gap it can't close: a
blanket `oxlint-disable` or `oxlint-disable-line` silences the report about itself too, so of the
blanket forms only `-next-line` gets caught (measured on oxlint 1.91.0).

`require-cause-when-narrowing` watches `mapError`, `catch` and `catchCause`, plus v3's `catchAll`,
`catchAllCause` and `orElse`. A handler is fine if it reads its error, passes a `cause`, or comes
after an `Effect.tapError`, `tapErrorCause` or `tapCause` in the same pipe. `catchTag` and the rest
of the targeted family are left alone: picking out one failure is a decision, not an accident.

`no-array-filter-map` only fires when the receiver is known to be an array: a literal, an
array-typed binding, `Array.from`, `Object.keys` and the like, or another array method's result.
Without type information anything else might be an iterator or a collection of your own.

`no-reduce-accumulator-copy` counts spreads (`{ ...acc }`, `[...acc]`), `Object.assign({}, acc)`,
`Array.from`, `structuredClone`, `new Map` and `new Set`, and the copying array methods when the
reduce starts from an array. That covers oxc's `no-accumulating-spread`, so there's no need to turn
it on as well.

`max-ternary-depth` takes `{ "maxDepth": 3 }` if two levels is too tight for you.

`no-test-code-in-src` holds that tests live in `test/`. Inside `src/` it reports `*.test.*` and
`*.spec.*` files, anything under a `test`, `tests` or `__tests__` directory, relative imports through
one, and exports named like a fake (`layerTest`, `FakeClock`, `makeMockUser`, …). Both directory
lists are options: `{ "sourceDirectories": ["src"], "testDirectories": ["test"] }`.

`no-service-parameters` lets a function that builds a layer take one, and leaves alone the callbacks
Effect's own APIs hand a context to. It and `require-operation-span` skip `*.test.*` and `*.spec.*`
files; a helper under `test/` with another name needs an override.

`require-operation-span` looks at the object a service's `make` generator returns. A property counts
as an operation when it is an Effect, or a function returning one, so plain values and helpers pass.
`Effect.fnUntraced` and an unnamed `Effect.fn` don't count as a span.

`no-comments` is the opinionated one. It holds that a name needing a sentence beside it is the wrong
name, and that durable knowledge belongs in a document rather than a line that drifts out of sync
with the code above it. It leaves `SAFETY:` comments and tooling directives alone: `oxlint-disable`,
`@ts-expect-error`, triple-slash references, shebangs, licence headers (`SPDX-License-Identifier:`,
`@license`), `nosemgrep`, bundler hints (`webpackChunkName:` and the other `webpack*:` magic
comments, `@vite-ignore`) and formatter ignores, `oxfmt-ignore` included.

Two options loosen it, and both are off by default:

- `{ "allowWarnings": true }` lets a single-line `// WARNING:` comment through, for a footgun that
  keeps coming back.
- `{ "publicApi": ["/packages/sdk/"] }` lets `/** */` TSDoc through in files whose path matches one
  of those regular expressions. It counts directly above an exported declaration, a declaration
  named in an `export { … }` list, or a public member of an exported class, interface, enum or object
  type. Anything tagged `@internal` or `@private` is still a comment.

`no-comments`, `no-switch` and `no-try-catch` take a per-file allowance, so you can turn them on in
a codebase that already breaks them and ratchet down from there:

```jsonc
{
  "rules": {
    "begone-slop/no-try-catch": ["error", { "allow": { "src/legacy/import.ts": 3 } }],
  },
}
```

The count is exact. A file at its allowance reports nothing. A file over it reports every case,
since there's no telling which one is new. A file under it reports once, asking for the entry to
come down, so the list only ever shrinks. A key matches the end of the path at a `/`, so
`"legacy/import.ts"` works as well.

`no-fixed-sleep` reports an `await` straight inside a `test`, `it` or hook callback when what it
waits on is a timer: `setTimeout` or `scheduler.wait` from `timers/promises`, `Bun.sleep`, or a
`new Promise` whose only job is to resolve from a global `setTimeout`. A file that calls
`vi.useFakeTimers()` or `jest.useFakeTimers()` is left alone, since its timers don't wait on the
clock. A sleep inside a helper the test calls isn't followed.

`no-flake-masking` reports `retry` in a test's options or a config's `test` block, `jest.retryTimes`,
a per-test `timeout` (an options key or the number after the callback), `vi.setConfig` with
`testTimeout` or `hookTimeout`, `jest.setTimeout` and bun's `setDefaultTimeout`. A timeout on
`beforeAll` and the other hooks is fine: that's where slow shared setup belongs.

`no-module-mocking` also reports `vi.stubGlobal`, and the spy methods that script an answer
(`mockImplementation`, `mockReturnValue` and their `Once` forms) on any receiver. Spies that only
watch, such as `vi.spyOn`, `vi.fn()`, `mockClear` and `mockRestore`, are fine. landmines'
`no-test-doubles` goes a long way further, down to `vi.fn(impl)` and fake responses, and this stops
short of it on purpose.

The layout rules group single-line `SCREAMING_CASE` constants. Private ones sit together with no
blank line between them, exported ones form a second group below them, and a blank line fences each
group off from everything else. `lint:fix` collapses the blank lines inside a group. In
`padding-line-between-statements` that is the `screaming-const` and `exported-screaming-const`
statement types with `"blankLine": "never"`, and `statement-order` reports a private constant placed
after an exported one, unless it reads that exported value:

```ts
const TAG_PATTERN = /^[a-z]+$/u
const DEFAULT_URL = 'https://example.com'

export const POD_TAG = 'pie'
export const RECIPE_TAG_PREFIX = 'pie-recipe-'

export const isValidTag = (tag: string) => TAG_PATTERN.test(tag)
```

## The tsconfig

The compiler settings the rules assume ship alongside them:

```jsonc
// tsconfig.json
{
  "extends": "@jliocsar/begone-slop/tsconfig",
  "include": ["src/**/*.ts"],
}
```

Unlike oxlint's `extends`, TypeScript's resolves a package specifier — this one goes through the
`exports` map, so the subpath has no `.json` on it (measured under TypeScript 7).

It is the [Effect recommendation](https://www.effect.solutions/tsconfig) as far as a bundler-driven
project can take it: `strict` plus `exactOptionalPropertyTypes`, `noUncheckedIndexedAccess`,
`noImplicitOverride`, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly` and
`noFallthroughCasesInSwitch`, on `ESNext` with `bundler` resolution.

Two things to know before extending it:

- **It sets `noEmit`.** The assumption is that a bundler emits and the compiler only checks — which
  is also what makes `allowImportingTsExtensions` legal. Override both if you emit with `tsc`.
- **It does not configure the Effect language service.** In an Effect project, add it yourself:

  ```jsonc
  {
    "extends": "@jliocsar/begone-slop/tsconfig",
    "compilerOptions": {
      "plugins": [{ "name": "@effect/language-service", "diagnostics": false }],
    },
  }
  ```

  Keep `diagnostics: false` if you lint with the `effecttsgo` oxlint rules. Leaving both on reports
  every diagnostic twice.

### Alongside `@effect/tsgo`

Two of tsgo's `recommended` rules steer toward code this preset rejects, so turn them off where
both run:

```jsonc
{
  "rules": {
    "effecttsgo/effect-map-void": "off",
    "effecttsgo/catch-to-ignore": "off",
  },
}
```

`effect-map-void` fixes a map to `undefined` into `Effect.asVoid`, which `no-effect-asvoid` rejects.
`catch-to-ignore` fixes a catch returning `Effect.void` into `Effect.ignore`, which
`no-silent-error-swallow` rejects unless it carries a `log` option. The preset can't switch them off
itself: naming a rule from a plugin that isn't loaded fails the config (measured on oxlint 1.90.0:
`Plugin 'effecttsgo' not found`).

Leave `unnecessary-effect-gen` on, but don't take its fix for a body with no return and a non-void
success: it writes `Effect.asVoid`, which `no-effect-asvoid` rejects (read in `@effect/tsgo` 0.67.4's
source, not run).

## Requirements

- **oxlint** `>=1.77.0`, as a peer of your project.
- **Node** — any current LTS runs the plugin, which ships as compiled ESM. A TypeScript config
  needs 22.18 or newer, or Bun.
- Nothing else. The only dependency is `@oxlint/plugins`, which is types plus a few identity
  functions. The Effect rules match Effect's API by name and import path, so linting Effect code
  doesn't pull Effect in.

## Caveat

oxlint's JS plugin support is alpha and explicitly not semver-bound. An oxlint upgrade can change
plugin behaviour without a major version bump. Every rule here is covered by a test that asserts
both the exact lines it reports on a deliberately-bad fixture _and_ that it reports nothing on a
clean one, so a break shows up as a failing test rather than a silent no-op.

## Possible improvements

- **`createOnce` instead of `create`.** Every rule uses `create`, which oxlint calls once per file,
  so per-file state is just local variables in a fresh closure. oxlint's `createOnce` builds each
  visitor once per run and resets state in a `before()` hook instead, saving a few allocations per
  file. Not worth it yet: the saving is noise next to oxlint handing each file's AST to JS, and a
  missed reset leaks state between files, which the single-file fixture tests can't catch.

## Prior art

Some of these rules exist because somebody else thought of them first. Four projects were used as a
reference while building this one, and it would be poor form not to say so. The `Source` column in
each rules table links the exact file a rule came from.

- **[anti-slop](https://github.com/dmmulroy/anti-slop)** by Dillon Mulroy — MIT. The evidence-first
  rules owe most to this one: the type-assertion family, the `unknown` and dictionary rules, and the
  idea that an assertion should have to justify itself.
- **[K-Mistele's anti-slop fork](https://github.com/k-mistele/anti-slop)** — MIT. The ideas behind
  `max-ternary-depth`, `no-array-filter-map`, `no-reduce-accumulator-copy`,
  `no-disabled-type-assertion-rules`, `require-cause-when-narrowing`, `no-manual-tagged-construction`,
  `no-test-code-in-src`, `prefer-tagged-error-handling`, `prefer-yield-service`,
  `no-reprovide-ambient-service`, `no-service-parameters`, `require-service-make-layer` and
  `require-operation-span`.
- **[ai-automation](https://github.com/typeonce-dev/ai-automation)** by typeonce-dev — the Effect
  rules, and a good chunk of the taste behind them.
- **[landmines](https://github.com/interfere-inc/landmines)** by Interfere — MIT. `no-fixed-sleep`
  and `no-flake-masking`, the exact-count allowance `no-comments`, `no-switch` and `no-try-catch`
  take, the stubbed globals and scripted spies `no-module-mocking` catches, and the extra directives
  and opt-in `WARNING:` and `publicApi` exemptions in `no-comments`.

Every rule here is an independent implementation written against a different plugin API, and the
diagnostics are our own. Where behaviour matches, it is because the underlying idea was right, not
because code was carried across. Any resemblance in wording has been removed deliberately.

If you like these, go and look at all four — they cover ground this one does not.

## Licence

MIT, with portions derived from `anti-slop` (also MIT) — see `LICENSE`.
