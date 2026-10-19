import type { QueryStore } from '@qnot/core';
import { mountQueryBuilder } from '@qnot/dom';

export const mount = (el: HTMLElement, store: QueryStore<any, any>): (() => void) => mountQueryBuilder(el, store);
