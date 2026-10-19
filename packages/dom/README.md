# @qnot/dom

Plain DOM bindings for qnot: a query builder with no framework.

```sh
pnpm add @qnot/core @qnot/dom
```

```ts
import '@qnot/core/styles.css';
import { createQueryStore, defineFields, f } from '@qnot/core';
import { mountQueryBuilder } from '@qnot/dom';

const fields = defineFields({ name: f.text(), age: f.number() });
const store = createQueryStore({ fields });
const dispose = mountQueryBuilder(document.getElementById('filters')!, store);
store.subscribe(() => console.log(store.getQuery()));
```

Docs: https://github.com/sean-brydon/trawlnet/tree/main/apps/web/content/docs

MIT licensed. Part of [qnot](https://github.com/sean-brydon/trawlnet).
