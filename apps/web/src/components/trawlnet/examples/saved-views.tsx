// Part of trawlnet (https://github.com/sean-brydon/trawlnet). MIT licensed; installable with shadcn.
'use client';
import { compile, defineFields, f, type Query, type QueryOf } from '@trawlnet/core';
import { QueryProvider, useHistory } from '@trawlnet/react';
import { BookmarkIcon, BookmarkPlusIcon, Redo2Icon, SaveIcon, Undo2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ScrollBox } from '@/components/trawlnet/scroll-box';
import { Tip } from '@/components/trawlnet/tip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { CossQueryBuilder } from '@/components/trawlnet/query-builder';
import { describeQuery } from '@/components/trawlnet/describe';
import { cn } from '@/lib/utils';
import { pickWith, rng, useExampleStore, useLiveQuery } from '@/components/trawlnet/examples/shared';



const fields = defineFields({
  stage: f.enum(['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost']),
  amount: f.number({ label: 'Amount', min: 0 }),
  owner: f.enum(['Ada', 'Grace', 'Linus', 'Radia']),
  region: f.enum(['NA', 'EMEA', 'APAC', 'LATAM']),
  daysInStage: f.number({ label: 'Days in stage', min: 0, integer: true }),
  closeDate: f.date({ label: 'Close date' }),
});
type Q = QueryOf<typeof fields>;

const rand = rng(17);
const pick = pickWith(rand);
const DEALS = Array.from({ length: 80 }, (_, i) => ({
  id: i,
  name: `${pick(['Acme', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Soylent', 'Stark', 'Wayne'])} · ${pick(['Platform', 'Expansion', 'Renewal', 'Pilot'])}`,
  stage: pick(['Lead', 'Qualified', 'Proposal', 'Negotiation', 'Won', 'Lost'] as const),
  amount: Math.round(rand() ** 2 * 120) * 1000 + 2000,
  owner: pick(['Ada', 'Grace', 'Linus', 'Radia'] as const),
  region: pick(['NA', 'EMEA', 'APAC', 'LATAM'] as const),
  daysInStage: Math.floor(rand() * 60),
  closeDate: new Date(Date.UTC(2026, 9, 1) + rand() * 180 * 864e5).toISOString().slice(0, 10),
}));

interface View {
  id: string;
  name: string;
  query: Q;
}

const g = (combinator: 'and' | 'or', children: Q['children']): Q => ({ kind: 'group', combinator, children });
const INITIAL_VIEWS: View[] = [
  { id: 'all', name: 'All open deals', query: g('and', [{ kind: 'rule', field: 'stage', operator: 'notIn', value: ['Won', 'Lost'] }]) },
  {
    id: 'big',
    name: 'Big & late-stage',
    query: g('and', [
      { kind: 'rule', field: 'stage', operator: 'in', value: ['Proposal', 'Negotiation'] },
      { kind: 'rule', field: 'amount', operator: 'gte', value: 50000 },
    ]),
  },
  {
    id: 'stalled',
    name: 'Stalled in EMEA',
    query: g('and', [
      { kind: 'rule', field: 'region', operator: 'eq', value: 'EMEA' },
      { kind: 'rule', field: 'daysInStage', operator: 'gt', value: 30 },
      { kind: 'rule', field: 'stage', operator: 'notIn', value: ['Won', 'Lost'] },
    ]),
  },
];

function HistoryButtons() {
  const { canUndo, canRedo, undo, redo } = useHistory();
  return (
    <>
      <Tip label={<span className="flex items-center gap-1">Undo <Kbd>⌘Z</Kbd></span>}>
        <Button size="icon-sm" variant="ghost" disabled={!canUndo} onClick={undo} aria-label="Undo">
          <Undo2Icon />
        </Button>
      </Tip>
      <Tip label={<span className="flex items-center gap-1">Redo <Kbd>⇧⌘Z</Kbd></span>}>
        <Button size="icon-sm" variant="ghost" disabled={!canRedo} onClick={redo} aria-label="Redo">
          <Redo2Icon />
        </Button>
      </Tip>
    </>
  );
}


export function Demo() {
  const [views, setViews] = useState(INITIAL_VIEWS);
  const [activeId, setActiveId] = useState('big');
  const active = views.find((v) => v.id === activeId)!;
  const store = useExampleStore(fields, active.query);
  const [loaded, setLoaded] = useState<Q>(() => store.getQuery());
  const query = useLiveQuery(store);
  const dirty = query !== loaded && JSON.stringify(query) !== JSON.stringify(active.query);
  const rows = useMemo(() => DEALS.filter(compile(fields, query)), [query]);
  const total = rows.reduce((n, d) => n + d.amount, 0);

  const open = (v: View) => {
    store.reset(v.query);
    setLoaded(store.getQuery());
    setActiveId(v.id);
  };
  const save = () => {
    const q = store.getQuery();
    setViews((vs) => vs.map((v) => (v.id === activeId ? { ...v, query: q } : v)));
    setLoaded(q);
  };
  const saveAs = () => {
    const id = `v${Date.now()}`;
    const q = store.getQuery();
    setViews((vs) => [...vs, { id, name: `${active.name} (copy)`, query: q }]);
    setActiveId(id);
    setLoaded(q);
  };

  return (
    <>
      <QueryProvider store={store}>
        <div className="grid gap-5 lg:grid-cols-[220px_minmax(0,1fr)]">
          <nav className="flex flex-col gap-0.5">
            <div className="px-2 pb-1 font-medium text-muted-foreground text-xs uppercase tracking-wide">Views</div>
            {views.map((v) => (
              <button
                key={v.id}
                type="button"
                data-view={v.id}
                onClick={() => open(v)}
                className={cn('flex items-center gap-2 rounded-lg px-2 py-1.5 text-start text-sm', v.id === activeId ? 'bg-muted font-medium' : 'hover:bg-muted/60')}
              >
                <BookmarkIcon className="size-3.5 text-muted-foreground" />
                <span className="truncate">{v.name}</span>
                {v.id === activeId && dirty && <span className="ms-auto size-1.5 rounded-full bg-warning" title="Unsaved changes" />}
              </button>
            ))}
          </nav>
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{active.name}</span>
              {dirty && <Badge variant="warning">Edited</Badge>}
              <div className="ms-auto flex items-center gap-1">
                <HistoryButtons />
                <Button size="sm" variant="outline" disabled={!dirty} onClick={save}>
                  <SaveIcon /> Save
                </Button>
                <Button size="sm" variant="ghost" onClick={saveAs}>
                  <BookmarkPlusIcon /> Save as new
                </Button>
              </div>
            </div>
            <p className="rounded-xl bg-muted/50 px-3 py-2 text-sm dark:bg-muted/30" data-sentence>
              <span className="text-muted-foreground">Show deals where </span>
              {describeQuery(fields, query as Query)}
            </p>
            <CossQueryBuilder store={store} />
            <div className="flex items-center gap-2 text-sm">
              <Badge variant="outline">{rows.length} deals</Badge>
              <span className="text-muted-foreground text-xs">${total.toLocaleString('en-US')} total</span>
            </div>
            <ScrollBox className="rounded-xl border" viewportClassName="max-h-80">
              <Table render={<div className="overflow-visible!" />}>
                <TableHeader>
                  <TableRow>
                    <TableHead>Deal</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-end">Amount</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Region</TableHead>
                    <TableHead className="text-end">Days</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.slice(0, 40).map((d) => (
                    <TableRow key={d.id}>
                      <TableCell className="font-medium">{d.name}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{d.stage}</Badge>
                      </TableCell>
                      <TableCell className="text-end tabular-nums">${d.amount.toLocaleString('en-US')}</TableCell>
                      <TableCell>{d.owner}</TableCell>
                      <TableCell>{d.region}</TableCell>
                      <TableCell className="text-end tabular-nums">{d.daysInStage}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollBox>
          </div>
        </div>
      </QueryProvider>
    </>
  );
}
