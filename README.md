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

That is the whole setup. `extends` pulls in the 37 rules the preset enables, and `jsPlugins` loads
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

`preset.json` sets `"plugins": []`. Extending a preset otherwise re-enables oxlint's own default
plugin set on top of your config, which fails the build on rules nobody chose. If you want
`unicorn`, `oxc` or the rest, list them yourself in your own `plugins` array — it takes precedence,
since later config wins.

## Rules

`✅` marks the rules the preset enables. `expect-padding` is off by default because it only makes
sense scoped to test files:

```jsonc
{
  "overrides": [{ "files": ["**/*.test.ts"], "rules": { "begone-slop/expect-padding": "error" } }],
}
```

### Evidence and type safety

| Rule                                        | What it rejects                                          | Preset |
| ------------------------------------------- | -------------------------------------------------------- | :----: |
| `no-banned-type-assertions`                 | assertions to `any`, `never` or `unknown`                |   ✅   |
| `no-chained-type-assertions`                | chained assertions, `x as unknown as T` included         |   ✅   |
| `no-widen-then-assert`                      | asserting a widened `const` back to a narrower type      |   ✅   |
| `no-known-value-widening`                   | widening a value of known shape into a broad annotation  |   ✅   |
| `require-safety-comment-for-type-assertion` | any assertion without a `SAFETY:` comment                |   ✅   |
| `no-unknown-parameters`                     | parameters annotated `unknown`, except one named `cause` |   ✅   |
| `no-unknown-returns`                        | functions whose return contract resolves to `unknown`    |   ✅   |
| `no-unknown-type-aliases`                   | type aliases that resolve to `unknown`                   |   ✅   |
| `no-unsafe-dictionary-type`                 | dictionary types whose value type is an escape hatch     |   ✅   |
| `no-object-parameters`                      | parameters typed `object`, aliases included              |   ✅   |
| `no-runtime-typeof`                         | `typeof` checks on values that were never parsed         |   ✅   |
| `no-in-operator`                            | the `in` operator used as an object-key probe            |   ✅   |
| `no-reflect-get`                            | `Reflect.get` in favour of typed property access         |   ✅   |
| `no-reflect-apply`                          | `Reflect.apply` in favour of a typed call                |   ✅   |
| `no-optional-function-parameters`           | optional parameters in favour of an explicit union       |   ✅   |

### Effect

| Rule                                | What it rejects                                               | Preset |
| ----------------------------------- | ------------------------------------------------------------- | :----: |
| `no-tag-access`                     | reading the private `_tag` discriminant directly              |   ✅   |
| `no-shadowed-error-field`           | a `name`/`stack` field that stops an error identifying itself |   ✅   |
| `no-silent-error-swallow`           | catch handlers that swallow the error with a void effect      |   ✅   |
| `no-disable-validation`             | `disableValidation: true`, which decodes without checking     |   ✅   |
| `no-service-option`                 | `Effect.serviceOption` instead of requiring the service       |   ✅   |
| `no-effect-asvoid`                  | `Effect.asVoid` where the effect can be returned directly     |   ✅   |
| `no-nested-layer-provide`           | nested `Layer.provide` calls                                  |   ✅   |
| `no-cascading-layer-provide`        | multiple `Layer.provide` stages in one pipe                   |   ✅   |
| `no-nested-effect-array-methods`    | one `effect/Array` call nested inside another                 |   ✅   |
| `no-shadowed-standard-array-static` | standard `Array` statics when `Array` is Effect's             |   ✅   |
| `prefer-option-from-nullable`       | a nullable `Option.some`/`Option.none` ternary                |   ✅   |
| `prefer-effect-match`               | chained literal ternaries over one subject                    |   ✅   |
| `pipe-max-arguments`                | a `.pipe()` call with more than 20 arguments                  |   ✅   |
| `no-sql-type-parameter`             | `sql<Type>` templates that assert a row shape                 |   ✅   |

### Structure and style

| Rule                                 | What it rejects                                       | Preset |
| ------------------------------------ | ----------------------------------------------------- | :----: |
| `no-comments`                        | every comment but `SAFETY:` and tooling directives    |   ✅   |
| `no-switch`                          | `switch` statements, in favour of `Match`             |   ✅   |
| `no-try-catch`                       | `try`/`catch`, in favour of `Effect.try`              |   ✅   |
| `no-module-mocking`                  | vitest, jest and bun module mocking                   |   ✅   |
| `no-reexport-only-modules`           | barrel modules that only re-export                    |   ✅   |
| `no-conditional-empty-object-spread` | omitting a field by spreading `{}`                    |   ✅   |
| `statement-order`                    | top-level declarations out of order                   |   ✅   |
| `padding-line-between-statements`    | missing blank lines, per a declarative spec           |   ✅   |
| `expect-padding`                     | a run of `expect()` calls not isolated by blank lines |   —    |

`no-comments` is the opinionated one. It holds that a name needing a sentence beside it is the wrong
name, and that durable knowledge belongs in a document rather than a line that drifts out of sync
with the code above it. It leaves `SAFETY:` comments and tooling directives (`oxlint-disable`,
`@ts-expect-error`, triple-slash references, shebangs) alone.

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
- **It configures the Effect language service with `diagnostics: false`.** Effect diagnostics come
  from the `effecttsgo` oxlint rules instead, and leaving both on reports every one of them twice.
  The block inherits through `extends`, and a child config can turn it back on (measured).

## Requirements

- **oxlint** `>=1.77.0`, as a peer of your project.
- **Node** — any current LTS runs the plugin, which ships as compiled ESM. A TypeScript config
  needs 22.18 or newer, or Bun.
- `effect` ships as a dependency, so there is nothing else to install.

## Caveat

oxlint's JS plugin support is alpha and explicitly not semver-bound. An oxlint upgrade can change
plugin behaviour without a major version bump. Every rule here is covered by a test that asserts
both the exact lines it reports on a deliberately-bad fixture _and_ that it reports nothing on a
clean one, so a break shows up as a failing test rather than a silent no-op.

## Prior art

Some of these rules exist because somebody else thought of them first. Two projects were used as a
reference while building this one, and it would be poor form not to say so:

- **[anti-slop](https://github.com/dmmulroy/anti-slop)** by Dillon Mulroy — MIT. The evidence-first
  rules owe most to this one: the type-assertion family, the `unknown` and dictionary rules, and the
  idea that an assertion should have to justify itself.
- **[ai-automation](https://github.com/typeonce-dev/ai-automation)** by typeonce-dev — the Effect
  rules, and a good chunk of the taste behind them.

Every rule here is an independent implementation written against a different plugin API, and the
diagnostics are our own. Where behaviour matches, it is because the underlying idea was right, not
because code was carried across. Any resemblance in wording has been removed deliberately.

If you like these, go and look at both projects — they cover ground this one does not.

## Licence

MIT, with portions derived from `anti-slop` (also MIT) — see `LICENSE`.
