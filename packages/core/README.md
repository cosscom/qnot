# @trawlnet/core

Framework-agnostic core of trawlnet: typed schema builders, the query store, validation, evaluation and format codecs.

```sh
pnpm add @trawlnet/core
```

```ts
import { compile, createQueryStore, defineFields, encode, f } from '@trawlnet/core';
import { sqlFormat } from '@trawlnet/core/formats/sql';

const fields = defineFields({ age: f.number({ min: 0 }), plan: f.enum(['free', 'pro']) });
const query = {
  kind: 'group',
  combinator: 'and',
  children: [{ kind: 'rule', field: 'age', operator: 'gte', value: 21 }],
} as const;

const store = createQueryStore({ fields, initial: query });     // drive any UI from this
const matches = compile(fields, store.getQuery());               // (row) => boolean
const { sql, params } = encode(sqlFormat({ dialect: 'postgres', params: 'numbered' }), store.getQuery(), fields);
```

Formats live under `@trawlnet/core/formats/*`: `sql`, `mongo`, `jsonlogic`, `elasticsearch`, `spel`, `text`, `rqb`, `raqb`, `jqqb`.
The default UI styles are in `@trawlnet/core/styles.css`.

Docs: https://github.com/sean-brydon/trawlnet/tree/main/apps/web/content/docs

MIT licensed. Part of [trawlnet](https://github.com/sean-brydon/trawlnet).
