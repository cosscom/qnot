'use client';
import '@qnot/core/styles.css';
import { encode, type Query, type QueryStore } from '@qnot/core';
import { jsonlogic } from '@qnot/core/formats/jsonlogic';
import { mongo } from '@qnot/core/formats/mongo';
import { sqlFormat } from '@qnot/core/formats/sql';
import { QueryProvider, useHistory, useIsValid, useQuery } from '@qnot/react';
import { Redo2Icon, Undo2Icon } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { CodeBlock } from '@/components/qnot/code-block';
import { describeQuery } from '@/components/qnot/describe';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs';
import { fields } from './demo-fields';

const pg = sqlFormat({ dialect: 'postgres', params: 'numbered' });

function safe<T>(fn: () => T): T | string {
  try {
    return fn();
  } catch (e) {
    return `// ${(e as Error).message}`;
  }
}

function Output() {
  const query = useQuery<typeof fields>();
  const out = useMemo(() => {
    const sql = safe(() => encode(pg, query, fields));
    return {
      sql: typeof sql === 'string' ? sql : `${sql.sql}\n\n-- params\n-- ${JSON.stringify(sql.params)}`,
      mongo: safe(() => JSON.stringify(encode(mongo, query, fields), null, 2)),
      jsonlogic: safe(() => JSON.stringify(encode(jsonlogic, query, fields), null, 2)),
    };
  }, [query]);
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <p className="text-muted-foreground text-sm leading-snug" data-demo-summary>
        <span className="font-medium text-foreground">Reads as: </span>
        {describeQuery(fields, query as Query) || 'Matches everything.'}
      </p>
      <Tabs defaultValue="sql">
        <TabsList>
          <TabsTab value="sql">SQL</TabsTab>
          <TabsTab value="mongo">MongoDB</TabsTab>
          <TabsTab value="jsonlogic">JsonLogic</TabsTab>
        </TabsList>
        <TabsPanel className="pt-3" value="sql">
          <CodeBlock code={out.sql} lang="sql" wrap />
        </TabsPanel>
        <TabsPanel className="pt-3" value="mongo">
          <CodeBlock code={out.mongo} lang="json" />
        </TabsPanel>
        <TabsPanel className="pt-3" value="jsonlogic">
          <CodeBlock code={out.jsonlogic} lang="json" />
        </TabsPanel>
      </Tabs>
    </div>
  );
}

function Toolbar({ label }: { label: string }) {
  const { canUndo, canRedo, undo, redo } = useHistory();
  const valid = useIsValid();
  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2 sm:px-4">
      <span className="font-mono text-muted-foreground text-xs">{label}</span>
      <Badge className="ms-1" variant={valid ? 'success' : 'warning'}>
        {valid ? 'Valid' : 'Incomplete'}
      </Badge>
      <div className="ms-auto flex items-center gap-1">
        <Button aria-label="Undo" disabled={!canUndo} onClick={undo} size="icon-sm" variant="ghost">
          <Undo2Icon />
        </Button>
        <Button aria-label="Redo" disabled={!canRedo} onClick={redo} size="icon-sm" variant="ghost">
          <Redo2Icon />
        </Button>
      </div>
    </div>
  );
}

/**
 * A live builder (any framework or kit) on one store, with undo/redo and the query exported to
 * SQL, MongoDB and JsonLogic as you edit. The children render the builder itself.
 */
export function DemoShell({ store, label, children }: { store: QueryStore<any, any>; label: string; children: ReactNode }) {
  return (
    <QueryProvider store={store}>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="min-w-0 overflow-hidden rounded-xl border bg-background shadow-xs/5" data-demo={label}>
          <Toolbar label={label} />
          <div className="overflow-x-auto p-3 sm:p-4">{children}</div>
        </div>
        <div className="min-w-0 rounded-xl border bg-background p-3 shadow-xs/5 sm:p-4">
          <Output />
        </div>
      </div>
    </QueryProvider>
  );
}
