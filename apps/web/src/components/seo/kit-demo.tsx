'use client';
import { createQueryStore } from '@qnot/core';
import { useState } from 'react';
import { KITS, type KitId } from '@/kits/preview';
import { DemoShell } from './demo-shell';
import { fields, initial } from './demo-fields';

/** One UI kit's builder (the same one `shadcn add` installs), live, with exports beside it. */
export function KitDemo({ kit, label }: { kit: KitId; label: string }) {
  const [store] = useState(() => createQueryStore({ fields, initial }));
  const Builder = KITS.find((k) => k.id === kit)!.builder;
  return (
    <DemoShell label={label} store={store}>
      <div data-kit-root={kit}>
        <Builder showLock store={store} />
      </div>
    </DemoShell>
  );
}
