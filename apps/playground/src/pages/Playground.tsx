import { compile, createQueryStore, getPath, isValidQuery, type Query, type QueryNode, type QueryStore } from '@trawlnet/core';
import { QueryBuilder, QueryProvider, useHistory, useIsValid, useQuery } from '@trawlnet/react';
import { Columns2Icon, Redo2Icon, Undo2Icon } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { ScrollBox } from '@/components/scroll-box';
import { Tip } from '@/components/tip';
import { AlertDialog, AlertDialogClose, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogPopup, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardPanel, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { CossQueryBuilder } from '@/coss/QueryBuilder';
import { sampleRows, type Customer } from '@/data';
import { FormatsPanel } from '@/FormatsPanel';
import { FORMATS } from '@/formats.vite';
import { Island, type IslandKind } from '@/islands/Islands';
import { describeQuery } from '@/lib/describe';
import { cn } from '@/lib/utils';
import { REGIONS, fields, initial, type Fields } from '@/schema';

const REGION_LABEL = new Map(REGIONS.flatMap((r) => r.children.map((c) => [c.value, c.label] as const)));
import { DEFAULT_SETTINGS, SettingsPopover, toStoreSettings, type PlaygroundSettings } from './Settings';

const countRules = (g: { children: readonly any[] }): number => g.children.reduce((n, c) => n + (c.kind === 'rule' ? 1 : countRules(c)), 0);

function Toolbar({ settings, onSettings }: { settings: PlaygroundSettings; onSettings: (s: PlaygroundSettings) => void }) {
  const { canUndo, canRedo, undo, redo } = useHistory();
  const valid = useIsValid();
  const query = useQuery<Fields>();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tip label={valid ? 'Every rule is complete and valid' : 'Some rules are incomplete; exports and filtering skip them'}>
        <Badge variant={valid ? 'success' : 'warning'}>{valid ? 'Valid' : 'Incomplete'}</Badge>
      </Tip>
      <span className="text-muted-foreground text-xs">{countRules(query)} rules</span>
      {settings.readOnly && <Badge variant="secondary">Read-only</Badge>}
      <div className="ms-auto flex items-center gap-1">
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
        <SettingsPopover value={settings} onChange={onSettings} />
      </div>
    </div>
  );
}

function JsonPanel() {
  const query = useQuery<Fields>();
  return (
    <ScrollBox className="rounded-lg bg-muted" viewportClassName="max-h-[70vh]">
      <pre className="p-3 font-mono text-xs">{JSON.stringify(query, null, 2)}</pre>
    </ScrollBox>
  );
}

const COLUMNS: { key: string; label: string; render?: (v: unknown, row: Customer) => string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'age', label: 'Age' },
  { key: 'plan', label: 'Plan' },
  { key: 'tags', label: 'Tags', render: (v) => ((v as string[]).length ? (v as string[]).join(', ') : '—') },
  { key: 'region', label: 'Region', render: (v) => REGION_LABEL.get(String(v)) ?? String(v) },
  { key: 'address.city', label: 'City' },
  { key: 'company', label: 'Company' },
  { key: 'distanceKm', label: 'Km' },
  {
    key: 'orders',
    label: 'Orders',
    render: (_, r) => (r.orders.length ? `${r.orders.length} (${r.orders.filter((o) => o.status === 'paid').length} paid)` : '—'),
  },
  { key: 'lastSeen', label: 'Last seen', render: (v) => String(v).slice(0, 10) },
];

function DataPanel() {
  const query = useQuery<Fields>();
  const rows = useMemo(() => sampleRows(1000), []);
  const { matched, ms, error } = useMemo(() => {
    const t0 = performance.now();
    try {
      const pred = compile(fields, query) as unknown as (r: Customer) => boolean;
      const matched = rows.filter(pred);
      return { matched, ms: performance.now() - t0, error: null };
    } catch (e) {
      return { matched: [], ms: 0, error: (e as Error).message };
    }
  }, [query, rows]);
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <Badge variant="outline" data-matched={matched.length}>
          {matched.length} / {rows.length} customers
        </Badge>
        <span className="text-muted-foreground text-xs">compiled + filtered in {ms.toFixed(2)} ms</span>
        {!isValidQuery(fields, query) && <span className="text-muted-foreground text-xs">(incomplete rules are skipped)</span>}
      </div>
      <p className="rounded-lg bg-muted/50 px-3 py-2 text-xs leading-relaxed dark:bg-muted/30">{describeQuery(fields, query as Query)}</p>
      {error && <p className="text-destructive-foreground text-xs">{error}</p>}
      <ScrollBox className="rounded-lg border" viewportClassName="max-h-[60vh]">
        <Table render={<div className="overflow-visible!" />}>
          <TableHeader>
            <TableRow>
              {COLUMNS.map((c) => (
                <TableHead key={c.key}>{c.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {matched.slice(0, 100).map((r, i) => (
              <TableRow key={i}>
                {COLUMNS.map((c) => {
                  const v = getPath(r, c.key);
                  return (
                    <TableCell key={c.key} className="whitespace-nowrap text-xs">
                      {c.render ? c.render(v, r) : String(v ?? '—')}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </ScrollBox>
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

function Renderer({ id, store, settings }: { id: Exclude<RendererId, 'all'>; store: QueryStore<any, any>; settings: PlaygroundSettings }) {
  if (id === 'coss') return <CossQueryBuilder store={store} showNot={settings.showNot} showLock={settings.showLock} />;
  if (id === 'react') return <QueryBuilder store={store} showNot={settings.showNot} showLock={settings.showLock} />;
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

interface Pending {
  node: QueryNode;
  resolve: (ok: boolean) => void;
}

export function PlaygroundPage() {
  const [store] = useState(() => createQueryStore({ fields, initial }));
  const [renderer, setRenderer] = useState<RendererId>('coss');
  const [settings, setSettings] = useState<PlaygroundSettings>(DEFAULT_SETTINGS);
  const [pending, setPending] = useState<Pending | null>(null);

  useEffect(() => {
    store.setSettings({
      ...toStoreSettings(settings),
      confirmRemove: settings.confirmRemove ? (node) => new Promise<boolean>((resolve) => setPending({ node, resolve })) : undefined,
    });
  }, [store, settings]);

  const answer = (ok: boolean) => {
    pending?.resolve(ok);
    setPending(null);
  };

  return (
    <QueryProvider store={store}>
      <main className={cn('grid gap-4 p-4', renderer === 'all' ? 'grid-cols-1' : 'xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]')}>
        <Card>
          <CardHeader>
            <CardTitle>Query</CardTitle>
            <Toolbar settings={settings} onSettings={setSettings} />
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
                    <ScrollBox viewportClassName="max-w-full">
                      <Renderer id={r.id as Exclude<RendererId, 'all'>} store={store} settings={settings} />
                    </ScrollBox>
                  </section>
                ))}
              </div>
            ) : (
              <Renderer id={renderer} store={store} settings={settings} />
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
                <FormatsPanel formats={FORMATS} />
              </TabsPanel>
              <TabsPanel value="json" className="pt-3">
                <JsonPanel />
              </TabsPanel>
            </Tabs>
          </CardPanel>
        </Card>
      </main>
      <AlertDialog open={!!pending} onOpenChange={(open) => !open && answer(false)}>
        <AlertDialogPopup>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this {pending?.node.kind === 'group' ? 'group' : 'rule'}?</AlertDialogTitle>
            <AlertDialogDescription>
              {pending && <span className="font-medium text-foreground">{describeQuery(fields, pending.node)}</span>}
              {pending?.node.kind === 'group' && ' and everything inside it'} will be removed. You can undo this.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogClose render={<Button variant="ghost" />}>Cancel</AlertDialogClose>
            <Button variant="destructive" onClick={() => answer(true)} data-confirm-remove>
              Remove
            </Button>
          </AlertDialogFooter>
        </AlertDialogPopup>
      </AlertDialog>
    </QueryProvider>
  );
}
