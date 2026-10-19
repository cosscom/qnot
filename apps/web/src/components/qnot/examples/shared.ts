// Part of qnot (https://github.com/cosscom/qnot). MIT licensed; installable with shadcn.
import { createQueryStore, type Fields, type QueryOf, type QueryStore } from '@qnot/core';
import { useState, useSyncExternalStore } from 'react';

/** One store for the component's lifetime. */
export function useExampleStore<F extends Fields>(fields: F, initial?: QueryOf<F>): QueryStore<F> {
  const [store] = useState(() => createQueryStore({ fields, ...(initial && { initial }) }) as unknown as QueryStore<F>);
  return store;
}

/** The store's current query, re-rendering on every change (for previews and filtering). */
export function useLiveQuery<F extends Fields>(store: QueryStore<F, any>): QueryOf<F> {
  return useSyncExternalStore(store.subscribe as (fn: () => void) => () => void, store.getQuery, store.getQuery);
}

/** Deterministic PRNG so sample data is stable between reloads. */
export function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const pickWith = (rand: () => number) => <T,>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)]!;
