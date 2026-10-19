/** @jsxImportSource solid-js */
import type { QueryStore } from '@qnot/core';
import { QueryBuilder } from '@qnot/solid';
import { render } from 'solid-js/web';

export const mount = (el: HTMLElement, store: QueryStore<any, any>): (() => void) => render(() => <QueryBuilder store={store} />, el);
