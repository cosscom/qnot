import type { QueryStore } from '@qnot/core';
import { QueryBuilder } from '@qnot/svelte';
import { mount as mountSvelte, unmount } from 'svelte';

export function mount(el: HTMLElement, store: QueryStore<any, any>): () => void {
  const c = mountSvelte(QueryBuilder, { target: el, props: { store } });
  return () => void unmount(c);
}
