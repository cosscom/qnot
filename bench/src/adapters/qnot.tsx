import { QueryBuilder } from '@qnot/react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { qnotAdapter } from './_qnot';
import { install } from '../runner';

install(
  qnotAdapter('@qnot/react', (el, store) => {
    const root = createRoot(el);
    flushSync(() => root.render(<QueryBuilder store={store} />));
    return () => root.unmount();
  }),
);
