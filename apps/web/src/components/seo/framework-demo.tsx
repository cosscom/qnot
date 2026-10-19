'use client';
import { createQueryStore } from '@qnot/core';
import { QueryBuilder } from '@qnot/react';
import { useState } from 'react';
import { Island, type IslandKind } from '@/playground/islands';
import { DemoShell } from './demo-shell';
import { fields, initial } from './demo-fields';

export type DemoFramework = 'react' | IslandKind;

/**
 * The default builder of one framework binding, live. React renders natively; Vue, Svelte, Solid
 * and the vanilla DOM builder are the playground's prebuilt islands, mounted on this page's store.
 */
export function FrameworkDemo({ framework, label }: { framework: DemoFramework; label: string }) {
  const [store] = useState(() => createQueryStore({ fields, initial }));
  return (
    <DemoShell label={label} store={store}>
      {framework === 'react' ? <QueryBuilder showLock store={store} /> : <Island kind={framework} store={store} />}
    </DemoShell>
  );
}
