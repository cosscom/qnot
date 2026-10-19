# qnot

A fast, fully typed, framework-agnostic query builder: build filter queries in a UI, keep them typed
end to end, evaluate them in JavaScript, and export them to SQL, MongoDB, JsonLogic, Elasticsearch,
SpEL, react-querybuilder or react-awesome-query-builder.

- **Typed from your schema**: `defineFields({ age: f.number() })` narrows every rule's operators and value.
- **Fast at scale**: a normalized store with per-node subscriptions; editing one rule re-renders one rule.
  At 1,000 rules a keystroke costs ~0.4 ms (react-querybuilder: ~57 ms); see [bench/results/REPORT.md](bench/results/REPORT.md).
- **Any framework, any UI kit**: React, Vue, Svelte 5, Solid and plain DOM bindings, each with headless
  hooks and a small unstyled default builder.
- **Runs on the server**: validate untrusted queries, then turn them into parameterized SQL.
- **Feature parity with react-awesome-query-builder**: see [docs/raqb-parity.md](docs/raqb-parity.md).

## Packages

| Package | |
|---|---|
| [`@qnot/core`](packages/core) | Schema, store, validation, evaluation, format codecs (`@qnot/core/formats/*`) |
| [`@qnot/react`](packages/react) | React hooks + `<QueryBuilder>` |
| [`@qnot/vue`](packages/vue) | Vue 3 composables + `QueryBuilder` |
| [`@qnot/svelte`](packages/svelte) | Svelte 5 helpers + `QueryBuilder.svelte` |
| [`@qnot/solid`](packages/solid) | Solid primitives + `<QueryBuilder>` |
| [`@qnot/dom`](packages/dom) | Plain DOM builder, no framework |

## Quick start

```sh
pnpm add @qnot/core @qnot/react
```

```tsx
import '@qnot/core/styles.css';
import { defineFields, f } from '@qnot/core';
import { QueryBuilder } from '@qnot/react';

const fields = defineFields({
  name: f.text(),
  age: f.number({ min: 0 }),
  plan: f.enum(['free', 'pro', 'team']),
});

export function Filters() {
  return <QueryBuilder fields={fields} onChange={(query) => console.log(query)} />;
}
```

Docs: [https://github.com/sean-brydon/trawlnet/tree/main/apps/web/content/docs](https://github.com/sean-brydon/trawlnet/tree/main/apps/web/content/docs) (also served by `apps/web`).

## Repository

| Path | |
|---|---|
| `packages/*` | The published packages (MIT) |
| `apps/web` | Website, docs, examples and playground (Next.js + Fumadocs, coss.com style; AGPL-3.0, see `apps/web/NOTICE.md`) |
| `bench` | Browser benchmark harness against other query builders (`node build.mjs && node run.mjs`) |
| `examples/server` | Server-side usage (validate + parameterized SQL) |

```sh
pnpm install
pnpm test          # vitest: unit, type and component tests for every package
pnpm typecheck
pnpm build         # builds every package to dist/
pnpm --filter web dev
```

## Going live

**Website** (`apps/web`, Next.js): import the repository in Vercel and set

| Setting | Value |
|---|---|
| Root Directory | `apps/web` (keep "include files outside the root directory" on: the site reads `docs/` and `bench/results/`) |
| Framework | Next.js (build command: the default `pnpm run build`, which also prebuilds the Vue/Svelte/Solid islands) |
| Environment | `NEXT_PUBLIC_SITE_URL=https://your-domain` once a domain is chosen (defaults to the Vercel production URL) |

`pnpm --filter web build` is what CI runs; it prerenders every page, including `/llms.txt`, `/llms-full.txt` and each docs page as `.md`.

**npm packages**: versioning uses [Changesets](https://github.com/changesets/changesets).

1. Create the `@qnot` organization on npm and add an automation token as the `NPM_TOKEN` repository secret.
2. Run the **Release** workflow (Actions → Release → Run workflow). It opens a "Version packages" PR from the pending changesets (the first release is `0.1.0`).
3. Merge that PR and run **Release** again: it publishes every package with provenance.

Nothing publishes automatically; the workflow only runs when started by hand.

## License

The packages are MIT. `apps/web` adapts code from coss.com (AGPL-3.0); see its NOTICE.
