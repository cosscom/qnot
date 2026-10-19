'use client';
// The building block for every "Try it" demo: a coss builder over a small schema, optional live
// settings controls, and outputs (plain text, SQL, Mongo, JSON, matching rows).
import { compile, createQueryStore, encode, type Fields, type Query, type QueryOf, type QueryStore, type StoreSettings } from '@trawlnet/core';
import { mongo } from '@trawlnet/core/formats/mongo';
import { sqlFormat } from '@trawlnet/core/formats/sql';
import { text } from '@trawlnet/core/formats/text';
import { QueryProvider, useHistory } from '@trawlnet/react';
import { Redo2Icon, Undo2Icon } from 'lucide-react';
import { useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { CodeBlock } from '@/components/code-block';
import { Tip } from '@/components/tip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { NumberField, NumberFieldDecrement, NumberFieldGroup, NumberFieldIncrement, NumberFieldInput } from '@/components/ui/number-field';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsPanel, TabsTab } from '@/components/ui/tabs';
import { CossQueryBuilder, type CossQueryBuilderOptions } from '@/coss/QueryBuilder';

export type Output = 'text' | 'sql' | 'mongo' | 'json' | 'rows';

const postgres = sqlFormat({ dialect: 'postgres', quoteIdentifiers: false });

function render(fn: () => unknown): { ok: true; text: string } | { ok: false; text: string } {
  try {
    const out = fn();
    return { ok: true, text: typeof out === 'string' ? out : JSON.stringify(out, null, 2) };
  } catch (e) {
    return { ok: false, text: (e as Error).message };
  }
}

export function useLive<F extends Fields>(store: QueryStore<F, any>): QueryOf<F> {
  return useSyncExternalStore(store.subscribe as (fn: () => void) => () => void, store.getQuery, store.getQuery);
}

/** A labelled switch bound to one store setting. */
export function SettingSwitch({ store, setting, label, hint, defaultValue }: { store: QueryStore<any, any>; setting: keyof StoreSettings; label: string; hint?: string; defaultValue: boolean }) {
  const [on, setOn] = useState(() => (store.settings[setting] as boolean | undefined) ?? defaultValue);
  return (
    <label className="flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm" data-demo-setting={setting}>
      <Switch
        checked={on}
        onCheckedChange={(v) => {
          setOn(v);
          store.setSettings({ [setting]: v });
        }}
      />
      <span>{label}</span>
      {hint && <code className="rounded bg-muted px-1 font-mono text-[10px] text-muted-foreground">{hint}</code>}
    </label>
  );
}

/** A labelled number bound to one store setting (empty = unset). */
export function SettingNumber({ store, setting, label }: { store: QueryStore<any, any>; setting: 'maxRules' | 'maxDepth'; label: string }) {
  const [v, setV] = useState<number | null>(() => store.settings[setting] ?? null);
  return (
    <div className="flex items-center gap-2 rounded-lg border px-2.5 py-1 text-sm" data-demo-setting={setting}>
      <span>{label}</span>
      <NumberField
        size="sm"
        className="w-28"
        min={0}
        value={v}
        onValueChange={(n) => {
          setV(n);
          store.setSettings({ [setting]: n ?? undefined });
        }}
      >
        <NumberFieldGroup>
          <NumberFieldDecrement />
          <NumberFieldInput placeholder="∞" aria-label={label} />
          <NumberFieldIncrement />
        </NumberFieldGroup>
      </NumberField>
    </div>
  );
}

function History() {
  const { canUndo, canRedo, undo, redo } = useHistory();
  return (
    <div className="flex items-center gap-1">
      <Tip label="Undo">
        <Button size="icon-sm" variant="outline" disabled={!canUndo} onClick={undo} aria-label="Undo">
          <Undo2Icon />
        </Button>
      </Tip>
      <Tip label="Redo">
        <Button size="icon-sm" variant="outline" disabled={!canRedo} onClick={redo} aria-label="Redo">
          <Redo2Icon />
        </Button>
      </Tip>
    </div>
  );
}

export interface MiniProps<F extends Fields> {
  fields: F;
  initial?: QueryOf<F>;
  settings?: StoreSettings;
  builder?: CossQueryBuilderOptions;
  outputs?: Output[];
  rows?: readonly object[];
  rowLabel?: (row: any) => string;
  /** Extra controls rendered above the builder, given the store. */
  controls?: (store: QueryStore<F>) => ReactNode;
  history?: boolean;
  /** Custom output panel (e.g. issues), given the live query. */
  extra?: { label: string; render: (query: QueryOf<F>, store: QueryStore<F>) => ReactNode };
}

export function Mini<F extends Fields>({ fields, initial, settings, builder, outputs = ['text', 'json'], rows, rowLabel, controls, history, extra }: MiniProps<F>) {
  const [store] = useState(() => createQueryStore({ fields, ...(initial && { initial }), ...(settings && { settings }) }) as unknown as QueryStore<F>);
  const query = useLive(store);
  const tabs = [...(rows ? (['rows'] as const) : []), ...outputs.filter((o) => o !== 'rows')];
  const matched = useMemo(() => {
    if (!rows) return null;
    try {
      return rows.filter(compile(fields, query) as unknown as (r: object) => boolean);
    } catch {
      return null;
    }
  }, [rows, fields, query]);

  const out = (o: Output) => {
    const q = query as Query;
    if (o === 'text') return render(() => encode(text, q, fields));
    if (o === 'sql') return render(() => encode(postgres, q, fields));
    if (o === 'mongo') return render(() => encode(mongo, q, fields));
    return render(() => q);
  };

  return (
    <QueryProvider store={store}>
      <div className="flex flex-col gap-3">
        {(controls || history) && (
          <div className="flex flex-wrap items-center gap-2">
            {controls?.(store)}
            {history && <History />}
          </div>
        )}
        <CossQueryBuilder store={store} {...builder} />
        <Tabs defaultValue={extra ? 'extra' : tabs[0]}>
          <TabsList>
            {extra && <TabsTab value="extra">{extra.label}</TabsTab>}
            {tabs.map((t) => (
              <TabsTab key={t} value={t}>
                {t === 'rows' ? 'Matches' : t === 'sql' ? 'SQL' : t === 'json' ? 'JSON' : t === 'mongo' ? 'MongoDB' : 'Text'}
              </TabsTab>
            ))}
          </TabsList>
          {extra && (
            <TabsPanel value="extra" className="pt-2">
              {extra.render(query, store)}
            </TabsPanel>
          )}
          {tabs.map((t) => (
            <TabsPanel key={t} value={t} className="pt-2">
              {t === 'rows' ? (
                <div className="flex flex-col gap-2" data-demo-rows>
                  <Badge variant="outline" className="w-fit">
                    {matched?.length ?? 0} of {rows!.length} match
                  </Badge>
                  <div className="flex flex-wrap gap-1.5">
                    {rows!.map((r, i) => {
                      const hit = matched?.includes(r);
                      return (
                        <span key={i} className={hit ? 'rounded-md border border-success/40 bg-success/10 px-2 py-0.5 text-xs' : 'rounded-md border px-2 py-0.5 text-muted-foreground text-xs line-through decoration-muted-foreground/40'}>
                          {rowLabel ? rowLabel(r) : JSON.stringify(r)}
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : (
                (() => {
                  const r = out(t);
                  return r.ok ? <CodeBlock wrap code={r.text} /> : <p className="rounded-lg border border-warning/40 bg-warning/8 p-3 text-xs">{r.text}</p>;
                })()
              )}
            </TabsPanel>
          ))}
        </Tabs>
      </div>
    </QueryProvider>
  );
}
