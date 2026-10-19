/** @jsxImportSource solid-js */
import { render } from 'solid-js/web';
import { QueryBuilder } from '../../../packages/solid/src/index';
import { qnotAdapter } from './_qnot';
import { install } from '../runner';

install(qnotAdapter('@qnot/solid', (el, store) => render(() => <QueryBuilder store={store} />, el)));
