# @trawlnet/svelte

Svelte 5 bindings for trawlnet: rune-friendly helpers plus `QueryBuilder.svelte`.

```sh
pnpm add @trawlnet/core @trawlnet/svelte
```

```svelte
<script lang="ts">
  import '@trawlnet/core/styles.css';
  import { createQueryStore, defineFields, f } from '@trawlnet/core';
  import { QueryBuilder } from '@trawlnet/svelte';

  const fields = defineFields({ name: f.text(), age: f.number() });
  const store = createQueryStore({ fields });
</script>

<QueryBuilder {store} />
```

Helpers: `setQueryStore`, `getQueryStore`, `createRule`, `createGroup`, `createQuery`, `createHistory`, …

Docs: https://github.com/sean-brydon/trawlnet/tree/main/apps/web/content/docs

MIT licensed. Part of [trawlnet](https://github.com/sean-brydon/trawlnet).
