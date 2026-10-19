'use client';
// Non-React renderers, prebuilt by `pnpm islands` into public/islands (see islands/vite.config.ts)
// and imported at runtime. Each gets the page's live store, so edits in one show up in every other.
import type { QueryStore } from '@qnot/core';
import { useEffect, useRef, useState } from 'react';
import { assetPath } from '@/lib/site';

export type IslandKind = 'vanilla' | 'vue' | 'svelte' | 'solid';

type Mount = (el: HTMLElement, store: QueryStore<any, any>) => () => void;

const FILES: Record<IslandKind, string> = { vanilla: assetPath('/islands/dom.js'), vue: assetPath('/islands/vue.js'), svelte: assetPath('/islands/svelte.js'), solid: assetPath('/islands/solid.js') };

// The URL is resolved by the browser, not the bundler: these files are built separately.
const load = (kind: IslandKind): Promise<{ mount: Mount }> => import(/* webpackIgnore: true */ /* turbopackIgnore: true */ FILES[kind]);

export function Island({ kind, store }: { kind: IslandKind; store: QueryStore<any, any> }) {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let dispose: (() => void) | undefined;
    let cancelled = false;
    load(kind).then(
      (mod) => {
        if (!cancelled && ref.current) dispose = mod.mount(ref.current, store);
      },
      (e: Error) => setError(`Couldn't load the ${kind} island (${e.message}). Run \`pnpm --filter web islands\`.`),
    );
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [kind, store]);
  return (
    <>
      {error && <p className="rounded-lg border border-warning/40 bg-warning/8 p-3 text-sm">{error}</p>}
      <div ref={ref} data-island={kind} />
    </>
  );
}
