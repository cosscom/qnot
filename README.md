# trawlnet

A fast, fully typed, framework-agnostic query builder: build filter queries in a UI, keep them typed
end to end, evaluate them in JavaScript, and export them to SQL, MongoDB, JsonLogic, Elasticsearch,
SpEL, react-querybuilder or react-awesome-query-builder.

- **Typed from your schema**: `defineFields({ age: f.number() })` narrows every rule's operators and value.
- **Fast at scale**: a normalized store with per-node subscriptions; editing one rule re-renders one rule.
  At 1,000 rules a keystroke costs ~0.5 ms (react-querybuilder: ~59 ms).
- **Any framework, any UI kit**: React, Vue, Svelte 5, Solid and plain DOM bindings, each with headless
  hooks and a small unstyled default builder.
- **Runs on the server**: validate untrusted queries, then turn them into parameterized SQL.
- **Feature parity with react-awesome-query-builder**: see [docs/raqb-parity.md](docs/raqb-parity.md).

## Packages

| Package | |
|---|---|
| [`@trawlnet/core`](packages/core) | Schema, store, validation, evaluation, format codecs (`@trawlnet/core/formats/*`) |
| [`@trawlnet/react`](packages/react) | React hooks + `<QueryBuilder>` |
| [`@trawlnet/vue`](packages/vue) | Vue 3 composables + `QueryBuilder` |
| [`@trawlnet/svelte`](packages/svelte) | Svelte 5 helpers + `QueryBuilder.svelte` |
| [`@trawlnet/solid`](packages/solid) | Solid primitives + `<QueryBuilder>` |
| [`@trawlnet/dom`](packages/dom) | Plain DOM builder, no framework |

## Quick start

```sh
pnpm add @trawlnet/core @trawlnet/react
```

```tsx
import '@trawlnet/core/styles.css';
import { defineFields, f } from '@trawlnet/core';
import { QueryBuilder } from '@trawlnet/react';

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
| `apps/web` | Website and docs (Next.js + Fumadocs, coss.com style; AGPL-3.0, see `apps/web/NOTICE.md`) |
| `apps/playground` | Vite playground used during development |
| `bench` | Browser benchmark harness against other query builders (`node build.mjs && node run.mjs`) |
| `examples/server` | Server-side usage (validate + parameterized SQL) |

```sh
pnpm install
pnpm test          # vitest: unit, type and component tests for every package
pnpm typecheck
pnpm build         # builds every package to dist/
pnpm --filter web dev
```

## License

The packages are MIT. `apps/web` adapts code from coss.com (AGPL-3.0); see its NOTICE.
