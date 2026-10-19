import { mount, unmount } from 'svelte';
import { QueryBuilder } from '../../../packages/svelte/src/index';
import { qnotAdapter } from './_qnot';
import { install } from '../runner';

install(
  qnotAdapter('@qnot/svelte', (el, store) => {
    const c = mount(QueryBuilder, { target: el, props: { store } });
    return () => void unmount(c);
  }),
);
