# @qnot/vue

Vue 3 bindings for qnot: composables plus a `QueryBuilder` component.

```sh
pnpm add @qnot/core @qnot/vue
```

```ts
import '@qnot/core/styles.css';
import { createQueryStore, defineFields, f } from '@qnot/core';
import { QueryBuilder } from '@qnot/vue';

const fields = defineFields({ name: f.text(), age: f.number() });
const store = createQueryStore({ fields });
// <QueryBuilder :store="store" />  or  <QueryBuilder :fields="fields" v-model="query" />
```

Composables: `useQueryStore`, `provideQueryStore`, `useRule`, `useGroup`, `useQuery`, `useHistory`, …

Docs: https://github.com/cosscom/qnot/tree/main/apps/web/content/docs

MIT licensed. Part of [qnot](https://github.com/cosscom/qnot).
