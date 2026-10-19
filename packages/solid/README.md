# @trawlnet/solid

Solid bindings for trawlnet: fine-grained primitives plus a `<QueryBuilder>`.

```sh
pnpm add @trawlnet/core @trawlnet/solid
```

```tsx
import '@trawlnet/core/styles.css';
import { createQueryStore, defineFields, f } from '@trawlnet/core';
import { QueryBuilder } from '@trawlnet/solid';

const fields = defineFields({ name: f.text(), age: f.number() });
const store = createQueryStore({ fields });

export const Filters = () => <QueryBuilder store={store} />;
```

Ships source through the `solid` export condition (compiled by your Solid build).

Docs: https://github.com/sean-brydon/trawlnet/tree/main/apps/web/content/docs

MIT licensed. Part of [trawlnet](https://github.com/sean-brydon/trawlnet).
