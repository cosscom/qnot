# @trawlnet/react

React bindings for trawlnet: headless hooks plus a small unstyled `<QueryBuilder>`.

```sh
pnpm add @trawlnet/core @trawlnet/react
```

```tsx
import '@trawlnet/core/styles.css';
import { defineFields, f } from '@trawlnet/core';
import { QueryBuilder } from '@trawlnet/react';

const fields = defineFields({ name: f.text(), age: f.number() });

export const Filters = () => <QueryBuilder fields={fields} onChange={(q) => save(q)} />;
```

Build your own UI with `useQueryStore`, `QueryProvider`, `useRule`, `useGroup`, `useQuery`, `useHistory` and the drag hooks.

Docs: https://github.com/sean-brydon/trawlnet/tree/main/apps/web/content/docs

MIT licensed. Part of [trawlnet](https://github.com/sean-brydon/trawlnet).
