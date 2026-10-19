# @qnot/react

React bindings for qnot: headless hooks plus a small unstyled `<QueryBuilder>`.

```sh
pnpm add @qnot/core @qnot/react
```

```tsx
import '@qnot/core/styles.css';
import { defineFields, f } from '@qnot/core';
import { QueryBuilder } from '@qnot/react';

const fields = defineFields({ name: f.text(), age: f.number() });

export const Filters = () => <QueryBuilder fields={fields} onChange={(q) => save(q)} />;
```

Build your own UI with `useQueryStore`, `QueryProvider`, `useRule`, `useGroup`, `useQuery`, `useHistory` and the drag hooks.

Docs: https://github.com/cosscom/qnot/tree/main/apps/web/content/docs

MIT licensed. Part of [qnot](https://github.com/cosscom/qnot).
