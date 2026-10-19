import { useSyncExternalStore } from 'react';

/**
 * useSyncExternalStore with the same snapshot on the server: stores are plain objects that exist
 * during SSR too, so server rendering (Next.js, Remix…) sees the real query instead of throwing.
 */
export const useSync = <T>(subscribe: (fn: () => void) => () => void, getSnapshot: () => T): T => useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
