import type { QueryStore } from '@trawlnet/core';
import { mountQueryBuilder } from '@trawlnet/dom';

export const mount = (el: HTMLElement, store: QueryStore<any, any>): (() => void) => mountQueryBuilder(el, store);
