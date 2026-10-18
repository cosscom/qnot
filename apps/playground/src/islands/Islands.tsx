// Non-React renderers mounted into React-managed elements. Each mounts once per store and tears
// itself down on unmount; they all share the same store, so edits in one appear in the others.
import type { QueryStore } from '@trawlnet/core';
import { mountQueryBuilder } from '@trawlnet/dom';
import { QueryBuilder as SvelteQB } from '@trawlnet/svelte';
import { QueryBuilder as VueQB } from '@trawlnet/vue';
import { mount, unmount } from 'svelte';
import { createApp, h } from 'vue';
import { useEffect, useRef } from 'react';
import { mountSolid } from './solid/mount';

type Mounter = (el: HTMLElement, store: QueryStore<any, any>) => () => void;

const mounters = {
  vanilla: (el, store) => mountQueryBuilder(el, store),
  vue: (el, store) => {
    const app = createApp({ render: () => h(VueQB, { store }) });
    app.mount(el);
    return () => app.unmount();
  },
  svelte: (el, store) => {
    const c = mount(SvelteQB, { target: el, props: { store } });
    return () => void unmount(c);
  },
  solid: mountSolid,
} satisfies Record<string, Mounter>;

export type IslandKind = keyof typeof mounters;

export function Island({ kind, store }: { kind: IslandKind; store: QueryStore<any, any> }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => mounters[kind](ref.current!, store), [kind, store]);
  return <div ref={ref} data-island={kind} />;
}
