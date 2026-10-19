import type { QueryStore } from '@trawlnet/core';
import { QueryBuilder } from '@trawlnet/svelte';
import { mount as mountSvelte, unmount } from 'svelte';

export function mount(el: HTMLElement, store: QueryStore<any, any>): () => void {
  const c = mountSvelte(QueryBuilder, { target: el, props: { store } });
  return () => void unmount(c);
}
