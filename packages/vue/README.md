# @trawlnet/vue

Vue 3 bindings for trawlnet: composables plus a `QueryBuilder` component.

```sh
pnpm add @trawlnet/core @trawlnet/vue
```

```ts
import '@trawlnet/core/styles.css';
import { createQueryStore, defineFields, f } from '@trawlnet/core';
import { QueryBuilder } from '@trawlnet/vue';

const fields = defineFields({ name: f.text(), age: f.number() });
const store = createQueryStore({ fields });
// <QueryBuilder :store="store" />  or  <QueryBuilder :fields="fields" v-model="query" />
```

Composables: `useQueryStore`, `provideQueryStore`, `useRule`, `useGroup`, `useQuery`, `useHistory`, …

Docs: https://github.com/sean-brydon/trawlnet/tree/main/apps/web/content/docs

MIT licensed. Part of [trawlnet](https://github.com/sean-brydon/trawlnet).
