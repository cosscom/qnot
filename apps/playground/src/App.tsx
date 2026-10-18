import '@trawlnet/core/styles.css';
import { compile, createQueryStore, isValidQuery } from '@trawlnet/core';
import { QueryBuilder, QueryProvider, useHistory, useIsValid, useQuery } from '@trawlnet/react';
import { Redo2Icon, Undo2Icon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Tip } from '@/components/tip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardPanel, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs';
import { CossQueryBuilder } from './coss/QueryBuilder';
import { sampleRows } from './data';
import { FormatsPanel } from './FormatsPanel';
import { fields, initial, type Fields } from './schema';

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

export function App() {
  const [store] = useState(() => createQueryStore({ fields, initial }));
  return (
    <QueryProvider store={store}>
      <div className="min-h-screen bg-background text-foreground">
        <header className="flex items-center gap-3 border-b px-6 py-3">
          <span className="font-semibold">⚓ trawlnet</span>
          <span className="text-muted-foreground text-sm">playground</span>
        </header>
        <main className="grid gap-4 p-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <Card>
            <CardHeader>
              <CardTitle>Query</CardTitle>
              <Toolbar />
            </CardHeader>
            <CardPanel>
              <Tabs defaultValue="coss">
                <TabsList className="mb-3">
                  <TabsTab value="coss">coss ui</TabsTab>
                  <TabsTab value="default">Unstyled default</TabsTab>
                </TabsList>
                <TabsPanel value="coss">
                  <CossQueryBuilder store={store} />
                </TabsPanel>
                <TabsPanel value="default">
                  <QueryBuilder store={store} />
                </TabsPanel>
              </Tabs>
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
      </div>
    </QueryProvider>
  );
}
