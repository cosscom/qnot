import type { QueryStore } from '@qnot/core';
import { QueryBuilder } from '@qnot/vue';
import { createApp, h } from 'vue';

export function mount(el: HTMLElement, store: QueryStore<any, any>): () => void {
  const app = createApp({ render: () => h(QueryBuilder, { store }) });
  app.mount(el);
  return () => app.unmount();
}
