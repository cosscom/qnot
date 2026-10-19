'use client';
// /kits: the same trawlnet query builder in five UI kits, all editing one store. Each kit is loaded
// on demand, so MUI and Mantine only download when picked.
import '@trawlnet/core/styles.css';
import { createQueryStore, type Query } from '@trawlnet/core';
import { QueryProvider, useQuery } from '@trawlnet/react';
import dynamic from 'next/dynamic';
import { useEffect, useState, type ComponentType } from 'react';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { CossQueryBuilder } from '@/coss/QueryBuilder';
import { describeQuery } from '@/lib/describe';
import { fields, initial } from '@/playground/schema';
import type { QueryBuilderProps } from './shared/builder';

const loading = () => <div className="h-96 animate-pulse rounded-xl border bg-muted/40" />;
const shadcn = dynamic(() => import('./shadcn').then((m) => m.QueryBuilder), { ssr: false, loading });
const mui = dynamic(() => import('./mui').then((m) => m.QueryBuilder), { ssr: false, loading });
const mantine = dynamic(() => import('./mantine').then((m) => m.QueryBuilder), { ssr: false, loading });
const headless = dynamic(() => import('./headless').then((m) => m.QueryBuilder), { ssr: false, loading });

export const KITS = [
  { id: 'coss', label: 'coss ui', builder: CossQueryBuilder as ComponentType<QueryBuilderProps> },
  { id: 'shadcn', label: 'shadcn/ui', builder: shadcn },
  { id: 'mui', label: 'MUI', builder: mui },
  { id: 'mantine', label: 'Mantine', builder: mantine },
  { id: 'headless', label: 'your own', builder: headless },
] as const;
type KitId = (typeof KITS)[number]['id'];

function Summary() {
  const query = useQuery();
  return (
    <p className="text-muted-foreground text-sm" data-summary>
      <span className="font-medium text-foreground">Same store, every kit: </span>
      {describeQuery(fields, query as Query) || 'Matches everything.'}
    </p>
  );
}

export function KitsPreview() {
  const [store] = useState(() => createQueryStore({ fields, initial }));
  const [kit, setKit] = useState<KitId>('coss');
  const [sentence, setSentence] = useState(false);
  const [showLock, setShowLock] = useState(false);
  // ?kit=mui deep links (also used by the smoke tests).
  useEffect(() => {
    const k = new URLSearchParams(location.search).get('kit');
    if (KITS.some((x) => x.id === k)) setKit(k as KitId);
  }, []);
  const Builder = KITS.find((k) => k.id === kit)!.builder;
  return (
    <div className="flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex flex-wrap items-center gap-3">
        <ToggleGroup size="sm" variant="outline" value={[kit]} onValueChange={(v) => v[0] && setKit(v[0] as KitId)} aria-label="UI kit">
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
  );
}
