import { createApp, h } from 'vue';
import { QueryBuilder } from '../../../packages/vue/src/index';
import { qnotAdapter } from './_qnot';
import { install } from '../runner';

install(
  qnotAdapter('@qnot/vue', (el, store) => {
    const app = createApp({ render: () => h(QueryBuilder, { store }) });
    app.mount(el);
    return () => app.unmount();
  }),
);
