/** @jsxImportSource solid-js */
import type { QueryStore } from '@trawlnet/core';
import { QueryBuilder } from '@trawlnet/solid';
import { render } from 'solid-js/web';

export const mountSolid = (el: HTMLElement, store: QueryStore<any, any>): (() => void) => render(() => <QueryBuilder store={store} />, el);
