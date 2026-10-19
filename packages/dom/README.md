# @trawlnet/dom

Plain DOM bindings for trawlnet: a query builder with no framework.

```sh
pnpm add @trawlnet/core @trawlnet/dom
```

```ts
import '@trawlnet/core/styles.css';
import { createQueryStore, defineFields, f } from '@trawlnet/core';
import { mountQueryBuilder } from '@trawlnet/dom';

const fields = defineFields({ name: f.text(), age: f.number() });
const store = createQueryStore({ fields });
const dispose = mountQueryBuilder(document.getElementById('filters')!, store);
store.subscribe(() => console.log(store.getQuery()));
```

Docs: https://github.com/sean-brydon/trawlnet/tree/main/apps/web/content/docs

MIT licensed. Part of [trawlnet](https://github.com/sean-brydon/trawlnet).
