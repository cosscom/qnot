# @qnot/solid

Solid bindings for qnot: fine-grained primitives plus a `<QueryBuilder>`.

```sh
pnpm add @qnot/core @qnot/solid
```

```tsx
import '@qnot/core/styles.css';
import { createQueryStore, defineFields, f } from '@qnot/core';
import { QueryBuilder } from '@qnot/solid';

const fields = defineFields({ name: f.text(), age: f.number() });
const store = createQueryStore({ fields });

export const Filters = () => <QueryBuilder store={store} />;
```

Ships source through the `solid` export condition (compiled by your Solid build).

Docs: https://github.com/sean-brydon/trawlnet/tree/main/apps/web/content/docs

MIT licensed. Part of [qnot](https://github.com/sean-brydon/trawlnet).
