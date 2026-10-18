import { compile, createQueryStore, isValidQuery, type QueryStore } from '@trawlnet/core';
import { QueryBuilder, QueryProvider, useHistory, useIsValid, useQuery } from '@trawlnet/react';
import { Columns2Icon, Redo2Icon, Undo2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Tip } from '@/components/tip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardPanel, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { CossQueryBuilder } from '@/coss/QueryBuilder';
import { sampleRows } from '@/data';
import { FormatsPanel } from '@/FormatsPanel';
import { Island, type IslandKind } from '@/islands/Islands';
import { fields, initial, type Fields } from '@/schema';

function Toolbar() {
  const { canUndo, canRedo, undo, redo } = useHistory();
  const valid = useIsValid();
  const query = useQuery<Fields>();
  return (
    <div className="flex items-center gap-2">
      <Tip label={valid ? 'Every rule is complete and valid' : 'Some rules are incomplete; exports and filtering skip them'}>
        <Badge variant={valid ? 'success' : 'warning'}>{valid ? 'Valid' : 'Incomplete'}</Badge>
      </Tip>
      <span className="text-muted-foreground text-xs">{countRules(query)} rules</span>
      <div className="ms-auto flex gap-1">
        <Tip label="Undo">
          <Button size="icon-sm" variant="ghost" disabled={!canUndo} onClick={undo} aria-label="Undo">
            <Undo2Icon />
          </Button>
        </Tip>
        <Tip label="Redo">
          <Button size="icon-sm" variant="ghost" disabled={!canRedo} onClick={redo} aria-label="Redo">
            <Redo2Icon />
          </Button>
        </Tip>
      </div>
    </div>
  );
}

const countRules = (g: { children: readonly any[] }): number => g.children.reduce((n, c) => n + (c.kind === 'rule' ? 1 : countRules(c)), 0);

function JsonPanel() {
  const query = useQuery<Fields>();
  return <pre className="max-h-[70vh] overflow-auto rounded-lg bg-muted p-3 font-mono text-xs">{JSON.stringify(query, null, 2)}</pre>;
}

function DataPanel() {
  const query = useQuery<Fields>();
  const rows = useMemo(() => sampleRows(fields, 1000), []);
  const { matched, ms } = useMemo(() => {
    const t0 = performance.now();
    const pred = compile(fields, query);
    const matched = rows.filter(pred);
    return { matched, ms: performance.now() - t0 };
  }, [query, rows]);
  const cols = Object.keys(fields);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2 text-sm">
        <Badge variant="outline">
          {matched.length} / {rows.length} rows
        </Badge>
        <span className="text-muted-foreground text-xs">compiled + filtered in {ms.toFixed(2)} ms</span>
        {!isValidQuery(fields, query) && <span className="text-muted-foreground text-xs">(incomplete rules are skipped)</span>}
      </div>
      <div className="max-h-[65vh] overflow-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              {cols.map((c) => (
                <TableHead key={c}>{c}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {matched.slice(0, 100).map((r, i) => (
              <TableRow key={i}>
                {cols.map((c) => (
                  <TableCell key={c} className="font-mono text-xs">
                    {String((r as Record<string, unknown>)[c] ?? '—')}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

const RENDERERS = [
  { id: 'coss', label: 'coss ui', hint: 'React + coss ui components on the headless hooks' },
  { id: 'react', label: 'React', hint: '@trawlnet/react default <QueryBuilder>' },
  { id: 'vanilla', label: 'Vanilla', hint: '@trawlnet/dom: no framework at all' },
  { id: 'vue', label: 'Vue', hint: '@trawlnet/vue default component' },
  { id: 'svelte', label: 'Svelte', hint: '@trawlnet/svelte default component' },
  { id: 'solid', label: 'Solid', hint: '@trawlnet/solid default component' },
  { id: 'all', label: 'All side by side', hint: 'Every renderer on the same store: edit one, watch the rest' },
] as const;
type RendererId = (typeof RENDERERS)[number]['id'];

function Renderer({ id, store }: { id: Exclude<RendererId, 'all'>; store: QueryStore<any, any> }) {
  if (id === 'coss') return <CossQueryBuilder store={store} />;
  if (id === 'react') return <QueryBuilder store={store} />;
  return <Island kind={id as IslandKind} store={store} />;
}

function RendererSwitch({ value, onChange }: { value: RendererId; onChange: (id: RendererId) => void }) {
  return (
    <ToggleGroup size="sm" variant="outline" className="flex-wrap" value={[value]} onValueChange={(v) => v[0] && onChange(v[0] as RendererId)}>
      {RENDERERS.map((r) => (
        <Tip key={r.id} label={r.hint}>
          <ToggleGroupItem value={r.id} data-renderer={r.id}>
            {r.id === 'all' && <Columns2Icon />}
            {r.label}
          </ToggleGroupItem>
        </Tip>
      ))}
    </ToggleGroup>
  );
}

export function PlaygroundPage() {
  const [store] = useState(() => createQueryStore({ fields, initial }));
  const [renderer, setRenderer] = useState<RendererId>('coss');
  return (
    <QueryProvider store={store}>
      <main className={cn('grid gap-4 p-4', renderer === 'all' ? 'grid-cols-1' : 'xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]')}>
        <Card>
          <CardHeader>
            <CardTitle>Query</CardTitle>
            <Toolbar />
          </CardHeader>
          <CardPanel className="flex flex-col gap-3">
            <RendererSwitch value={renderer} onChange={setRenderer} />
            {renderer === 'all' ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {RENDERERS.filter((r) => r.id !== 'all').map((r) => (
                  <section key={r.id} className="flex min-w-0 flex-col gap-2 rounded-xl border p-3" data-panel={r.id}>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{r.label}</Badge>
                      <span className="truncate text-muted-foreground text-xs">{r.hint}</span>
                    </div>
                    <div className="min-w-0 overflow-x-auto">
                      <Renderer id={r.id as Exclude<RendererId, 'all'>} store={store} />
                    </div>
                  </section>
                ))}
              </div>
            ) : (
              <Renderer id={renderer} store={store} />
            )}
          </CardPanel>
        </Card>
        <Card>
          <CardPanel>
            <Tabs defaultValue="data">
              <TabsList>
                <TabsTab value="data">Data</TabsTab>
                <TabsTab value="formats">Formats</TabsTab>
                <TabsTab value="json">JSON</TabsTab>
              </TabsList>
              <TabsPanel value="data" className="pt-3">
                <DataPanel />
              </TabsPanel>
              <TabsPanel value="formats" className="pt-3">
                <FormatsPanel />
              </TabsPanel>
              <TabsPanel value="json" className="pt-3">
                <JsonPanel />
              </TabsPanel>
            </Tabs>
          </CardPanel>
        </Card>
      </main>
    </QueryProvider>
  );
}
