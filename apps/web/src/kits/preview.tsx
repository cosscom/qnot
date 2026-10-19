'use client';
// /kits: the same qnot query builder in five UI kits, all editing one store. Each kit is loaded
// on demand, so MUI only downloads when picked.
import '@qnot/core/styles.css';
import { createQueryStore, type Query } from '@qnot/core';
import { QueryProvider, useQuery } from '@qnot/react';
import dynamic from 'next/dynamic';
import { useEffect, useState, type ComponentType, type ReactNode } from 'react';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { CossQueryBuilder } from '@/components/qnot/query-builder';
import { describeQuery } from '@/components/qnot/describe';
import { fields, initial } from '@/playground/schema';
import type { QueryBuilderProps } from '@/components/qnot/kits/shared/builder';

const loading = () => <div className="h-96 animate-pulse rounded-xl border bg-muted/40" />;
const shadcn = dynamic(() => import('@/components/qnot/kits/shadcn').then((m) => m.QueryBuilder), { ssr: false, loading });
const mui = dynamic(() => import('@/components/qnot/kits/mui').then((m) => m.QueryBuilder), { ssr: false, loading });
const headless = dynamic(() => import('@/components/qnot/kits/headless').then((m) => m.QueryBuilder), { ssr: false, loading });

export const KITS = [
  { id: 'coss', label: 'coss ui', builder: CossQueryBuilder as ComponentType<QueryBuilderProps> },
  { id: 'shadcn', label: 'shadcn/ui', builder: shadcn },
  { id: 'mui', label: 'MUI', builder: mui },
  { id: 'headless', label: 'your own', builder: headless },
] as const;
export type KitId = (typeof KITS)[number]['id'];

function Summary() {
  const query = useQuery();
  return (
    <p className="text-muted-foreground text-sm" data-summary>
      <span className="font-medium text-foreground">Same store, every kit: </span>
      {describeQuery(fields, query as Query) || 'Matches everything.'}
    </p>
  );
}

/** The live builder on the drafting grid; below it, the selected kit's install command and source. */
export function KitsPreview({ code }: { code: Record<KitId, ReactNode> }) {
  const [store] = useState(() => createQueryStore({ fields, initial }));
  const [kit, setKit] = useState<KitId>('coss');
  const [sentence, setSentence] = useState(false);
  const [showLock, setShowLock] = useState(false);
  // ?kit=mui deep links (also used by the smoke tests), kept in sync as the switcher changes.
  useEffect(() => {
    const k = new URLSearchParams(location.search).get('kit');
    if (KITS.some((x) => x.id === k)) setKit(k as KitId);
  }, []);
  const select = (next: KitId) => {
    setKit(next);
    const url = new URL(location.href);
    url.searchParams.set('kit', next);
    history.replaceState(history.state, '', url);
  };
  const Builder = KITS.find((k) => k.id === kit)!.builder;
  return (
    <>
      <section className="drafting-grid border-b">
        <div className="flex flex-col gap-4 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <ToggleGroup size="sm" variant="outline" value={[kit]} onValueChange={(v) => v[0] && select(v[0] as KitId)} aria-label="UI kit">
              {KITS.map((k) => (
                <ToggleGroupItem key={k.id} value={k.id} data-kit-tab={k.id}>
                  {k.label}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
            <label className="ms-auto inline-flex items-center gap-2 text-sm">
              <Switch checked={sentence} onCheckedChange={setSentence} /> Sentence header
            </label>
            <label className="inline-flex items-center gap-2 text-sm">
              <Switch checked={showLock} onCheckedChange={setShowLock} /> Locks
            </label>
          </div>
          <div className="rounded-xl border bg-background p-3 sm:p-4" data-kit-root={kit}>
            <Builder store={store} showLock={showLock} combinatorStyle={sentence ? 'sentence' : 'toggle'} />
          </div>
          <QueryProvider store={store}>
            <Summary />
          </QueryProvider>
        </div>
      </section>
      <section className="px-4 py-10 sm:px-8" data-kit-code={kit}>
        {code[kit]}
      </section>
    </>
  );
}
