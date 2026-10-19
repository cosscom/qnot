# @qnot/svelte

Svelte 5 bindings for qnot: rune-friendly helpers plus `QueryBuilder.svelte`.

```sh
pnpm add @qnot/core @qnot/svelte
```

```svelte
<script lang="ts">
  import '@qnot/core/styles.css';
  import { createQueryStore, defineFields, f } from '@qnot/core';
  import { QueryBuilder } from '@qnot/svelte';

  const fields = defineFields({ name: f.text(), age: f.number() });
  const store = createQueryStore({ fields });
</script>

<QueryBuilder {store} />
```

Helpers: `setQueryStore`, `getQueryStore`, `createRule`, `createGroup`, `createQuery`, `createHistory`, …

Docs: https://github.com/sean-brydon/trawlnet/tree/main/apps/web/content/docs

MIT licensed. Part of [qnot](https://github.com/sean-brydon/trawlnet).
