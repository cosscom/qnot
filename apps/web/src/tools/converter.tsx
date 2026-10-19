'use client';

import { encode, type Query, type QueryNode } from '@qnot/core';
import type { SqlDialect } from '@qnot/core/formats/sql';
import { CheckIcon, ChevronDownIcon, CircleAlertIcon, CopyIcon, EraserIcon, LockIcon, RotateCcwIcon, TriangleAlertIcon } from 'lucide-react';
import { type ReactNode, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { CodeBlock } from '@/components/qnot/code-block';
import { useHighlight } from '@/components/qnot/highlight';
import { ScrollBox } from '@/components/qnot/scroll-box';
import { Tip } from '@/components/qnot/tip';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs';
import { withBrand } from '@/lib/site';
import { useCopy } from '@/lib/use-copy';
import { cn } from '@/lib/utils';
import { toolBySlug } from './catalog';
import { inputError, outputError, type ToolError } from './errors';
import { DIALECTS, FORMATS, PARAM_MODES, codecExpr, codecFor, parseInput, renderOutput, type FormatId, type ParamMode, type Rendered, type SqlSettings } from './formats';
import { decodeInferred, flatFields, schemaCode, toFields, type InferredSchema } from './infer';

const PLAIN_COLUMN = /^[A-Za-z_][A-Za-z0-9_$]*(\.[A-Za-z_][A-Za-z0-9_$]*)*$/;

const countRules = (n: QueryNode): number => (n.kind === 'rule' ? 1 : n.children.reduce((s, c) => s + countRules(c), 0));

/** Variable names for the app snippet. */
const VAR: Record<FormatId, string> = { sql: 'where', mongo: 'filter', jsonlogic: 'logic', rqb: 'rqbQuery', raqb: 'tree', jqqb: 'rules', elasticsearch: 'esQuery', spel: 'expression', text: 'sentence' };

function appSnippet(from: FormatId, to: FormatId, schema: InferredSchema, inSql: SqlSettings, outSql: SqlSettings): string {
  const core = ['decode', 'defineFields', 'encode', 'f', ...(schema.usesFunctions ? ['builtinFunctions'] : [])].sort();
  const imports = [...new Set([`import { ${core.join(', ')} } from '@qnot/core';`, FORMATS[from].importLine, FORMATS[to].importLine])];
  const out = to === 'sql' && outSql.params !== 'inline' ? 'const { sql, params } =' : `const ${VAR[to]} =`;
  return withBrand(
    [
      '// pnpm add @qnot/core',
      ...imports,
      '',
      '// The schema the converter inferred: tighten it (enums, required…) for your app.',
      schemaCode(schema),
      '',
      `const query = decode(${codecExpr(from, inSql, true)}, ${VAR[from]}, fields);`,
      `${out} encode(${codecExpr(to, outSql)}, query, fields);`,
    ].join('\n'),
  );
}

function SettingSelect<T extends string>({ label, value, items, onChange, className }: { label: string; value: T; items: { value: T; label: string }[]; onChange: (v: T) => void; className?: string }) {
  return (
    <Select items={items} value={value} onValueChange={(v) => v !== null && onChange(v as T)}>
      <SelectTrigger aria-label={label} className={cn('w-auto min-w-0 bg-background', className)} size="sm">
        <SelectValue />
      </SelectTrigger>
      <SelectPopup>
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}

function ErrorNote({ error, tone }: { error: ToolError; tone: 'input' | 'output' }) {
  const Icon = tone === 'input' ? CircleAlertIcon : TriangleAlertIcon;
  return (
    <div
      className={cn('flex items-start gap-3 rounded-xl border p-4 text-sm', tone === 'input' ? 'border-destructive/32 bg-destructive/4' : 'border-warning/40 bg-warning/8')}
      data-tool-error={tone}
      role="alert"
    >
      <Icon className={cn('mt-0.5 size-4 shrink-0', tone === 'input' ? 'text-destructive-foreground' : 'text-warning-foreground')} />
      <div className="flex min-w-0 flex-col gap-1">
        <div className="font-medium">{error.title}</div>
        <div className="break-words font-mono text-muted-foreground text-xs leading-relaxed">{error.detail}</div>
        {error.hint && <div className="text-muted-foreground leading-snug">{error.hint}</div>}
      </div>
    </div>
  );
}

function Output({ rendered }: { rendered: Rendered }) {
  const html = useHighlight(rendered.code, rendered.lang);
  const cls = 'font-mono text-[12.5px] leading-relaxed';
  return html ? (
    <div
      className={cn(cls, '[&_.shiki]:bg-transparent! [&_.shiki]:p-4 [&_.shiki_span]:text-(--shiki-light) dark:[&_.shiki_span]:text-(--shiki-dark) [&_pre]:w-max [&_pre]:min-w-full')}
      data-tool-output
      // Shiki's output: the codec's string, escaped by the highlighter.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  ) : (
    <pre className={cn(cls, 'w-max min-w-full p-4')} data-tool-output>
      {rendered.code}
    </pre>
  );
}

/** A panel's top bar: a mono caption on the left, controls on the right. */
function PanelBar({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('flex min-h-12 flex-wrap items-center gap-2 border-b px-3 py-2 sm:px-4', className)}>{children}</div>;
}

/**
 * A converter: paste one format, get another, live. Decoding infers a schema from the input, so
 * any query converts; everything runs in the browser.
 */
export function Converter({ slug, notes }: { slug: string; notes: ReactNode }) {
  const tool = toolBySlug(slug)!;
  const { from } = tool;
  const [input, setInput] = useState(tool.sample);
  const [target, setTarget] = useState<FormatId>(tool.to[0]!);
  const [inDialect, setInDialect] = useState<SqlDialect>('postgres');
  const [outDialect, setOutDialect] = useState<SqlDialect>('postgres');
  const [params, setParams] = useState<ParamMode>('inline');
  const [caseSensitive, setCaseSensitive] = useState(true);
  const [schemaOpen, setSchemaOpen] = useState(false);
  const deferred = useDeferredValue(input);
  const { copied, copy } = useCopy();
  // Timings differ between the server render and the browser: show them once hydrated.
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const decoded = useMemo(() => {
    if (!deferred.trim()) return { empty: true as const };
    const t0 = performance.now();
    try {
      const r = decodeInferred(codecFor(from, { dialect: inDialect, params: 'inline' }), parseInput(from, deferred));
      return { ok: r, ms: performance.now() - t0 };
    } catch (e) {
      return { error: inputError(from, e) };
    }
  }, [deferred, from, inDialect]);

  const result = 'ok' in decoded ? decoded.ok : undefined;
  const schema: InferredSchema | undefined = useMemo(
    () => result && { ...result.schema, caseSensitive: caseSensitive && (target === 'mongo' || target === 'elasticsearch') },
    [result, caseSensitive, target],
  );
  const flat = useMemo(() => (schema ? flatFields(schema.fields) : []), [schema]);
  const quoteIdentifiers = flat.some((fd) => fd.kind !== 'array' && !PLAIN_COLUMN.test(fd.name));
  const inSql: SqlSettings = { dialect: inDialect, params: 'inline' };
  const outSql: SqlSettings = { dialect: outDialect, params, quoteIdentifiers };

  const output = useMemo(() => {
    if (!result || !schema) return undefined;
    const t0 = performance.now();
    try {
      const out = encode(codecFor(target, outSql), result.query as Query, toFields(schema));
      return { rendered: renderOutput(target, out), ms: performance.now() - t0 };
    } catch (e) {
      return { error: outputError(target, e) };
    }
    // outSql is rebuilt each render; its parts are the real dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result, schema, target, outDialect, params, quoteIdentifiers]);

  const rendered = output && 'rendered' in output ? output.rendered : undefined;
  const copyText = rendered ? (rendered.params ? `${rendered.code}\n\n-- params\n${rendered.params}` : rendered.code) : '';
  const snippet = schema ? appSnippet(from, target, schema, inSql, outSql) : undefined;
  const rules = result ? countRules(result.query) : 0;
  const status: 'ok' | 'error' | 'empty' = 'empty' in decoded ? 'empty' : 'error' in decoded || (output && 'error' in output) ? 'error' : 'ok';

  return (
    <>
      <section aria-label={tool.title} className="drafting-grid border-b px-4 py-8 sm:px-8 sm:py-10">
        <div className="mx-auto w-full max-w-[1280px] overflow-hidden rounded-2xl border bg-card shadow-xs/5" data-tool={slug}>
          <div className="grid grid-cols-1 lg:grid-cols-2 lg:divide-x">
            {/* Input */}
            <div className="flex min-w-0 flex-col border-b lg:border-b-0">
              <PanelBar>
                <span className="font-mono text-muted-foreground text-xs">
                  <span className="text-foreground">input</span> · {FORMATS[from].label}
                </span>
                <div className="ms-auto flex items-center gap-1.5">
                  {from === 'sql' && <SettingSelect items={DIALECTS} label="Input SQL dialect" onChange={setInDialect} value={inDialect} />}
                  <Tip label="Load the sample">
                    <Button aria-label="Load the sample" data-tool-sample onClick={() => setInput(tool.sample)} size="icon-sm" variant="ghost">
                      <RotateCcwIcon />
                    </Button>
                  </Tip>
                  <Tip label="Clear">
                    <Button aria-label="Clear the input" onClick={() => setInput('')} size="icon-sm" variant="ghost">
                      <EraserIcon />
                    </Button>
                  </Tip>
                </div>
              </PanelBar>
              <textarea
                aria-label={`${FORMATS[from].label} to convert`}
                autoCapitalize="off"
                autoComplete="off"
                autoCorrect="off"
                className="min-h-72 w-full flex-1 resize-y bg-transparent p-4 font-mono text-[12.5px] leading-relaxed outline-none placeholder:text-muted-foreground/64 focus-visible:bg-muted/24 lg:min-h-[26rem]"
                data-tool-input
                onChange={(e) => setInput(e.target.value)}
                placeholder={from === 'sql' ? "status = 'active' AND age >= 21" : 'Paste JSON here'}
                spellCheck={false}
                value={input}
              />
              {'error' in decoded && decoded.error && (
                <div className="border-t p-3 sm:p-4">
                  <ErrorNote error={decoded.error} tone="input" />
                </div>
              )}
            </div>

            {/* Output */}
            <div className="flex min-w-0 flex-col">
              <PanelBar>
                {tool.to.length > 1 ? (
                  <Tabs onValueChange={(v) => setTarget(v as FormatId)} value={target}>
                    <TabsList size="sm">
                      {tool.to.map((t) => (
                        <TabsTab data-tool-target={t} key={t} value={t}>
                          {FORMATS[t].short}
                        </TabsTab>
                      ))}
                    </TabsList>
                  </Tabs>
                ) : (
                  <span className="font-mono text-muted-foreground text-xs">
                    <span className="text-foreground">output</span> · {FORMATS[target].label}
                  </span>
                )}
                <div className="ms-auto flex flex-wrap items-center justify-end gap-1.5">
                  {target === 'sql' && (
                    <>
                      <SettingSelect items={DIALECTS} label="Output SQL dialect" onChange={setOutDialect} value={outDialect} />
                      <SettingSelect items={PARAM_MODES} label="How values are written" onChange={setParams} value={params} />
                    </>
                  )}
                  {(target === 'mongo' || target === 'elasticsearch') && (
                    <label className="flex cursor-pointer items-center gap-2 px-1 text-muted-foreground text-xs">
                      <Switch checked={caseSensitive} onCheckedChange={setCaseSensitive} />
                      Case-sensitive
                    </label>
                  )}
                  <Tip label={copied ? 'Copied' : 'Copy the output'}>
                    <Button aria-label="Copy the output" data-tool-copy disabled={!rendered} onClick={() => copy(copyText)} size="icon-sm" variant="ghost">
                      {copied ? <CheckIcon /> : <CopyIcon />}
                    </Button>
                  </Tip>
                </div>
              </PanelBar>
              <div className="relative flex min-h-72 flex-1 flex-col bg-code/40 lg:min-h-[26rem]">
                {rendered ? (
                  <ScrollBox className="flex-1" viewportClassName="max-h-[34rem]">
                    <Output rendered={rendered} />
                    {rendered.params && (
                      <div className="border-t border-dashed">
                        <div className="px-4 pt-3 font-mono text-muted-foreground text-xs">params</div>
                        <Output rendered={{ code: rendered.params, lang: 'json' }} />
                      </div>
                    )}
                  </ScrollBox>
                ) : output && 'error' in output && output.error ? (
                  <div className="p-3 sm:p-4">
                    <ErrorNote error={output.error} tone="output" />
                  </div>
                ) : (
                  <div className="flex flex-1 items-center justify-center p-8 text-center text-muted-foreground text-sm">
                    {'empty' in decoded ? `Paste ${FORMATS[from].label} on the left to convert it.` : 'Fix the input to see the output.'}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status and the inferred schema */}
          <Collapsible onOpenChange={setSchemaOpen} open={schemaOpen}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t bg-muted/24 px-3 py-2.5 text-xs sm:px-4">
              <span className="flex items-center gap-2 font-mono text-muted-foreground" data-tool-status={status}>
                <span className={cn('size-2 rounded-full', status === 'ok' ? 'bg-teal-500 dark:bg-teal-400' : status === 'error' ? 'bg-destructive' : 'bg-muted-foreground/40')} />
                {status === 'ok' && output && 'rendered' in output && output.ms !== undefined
                  ? `${rules} ${rules === 1 ? 'rule' : 'rules'} · ${flat.length} ${flat.length === 1 ? 'field' : 'fields'} · ${hydrated ? `${((decoded as { ms: number }).ms + output.ms).toFixed(1)} ms` : 'converted'}`
                  : status === 'empty'
                    ? 'waiting for input'
                    : 'error'}
              </span>
              <span className="flex items-center gap-1.5 text-muted-foreground">
                <LockIcon className="size-3.5" /> Runs in your browser: nothing leaves it.
              </span>
              <CollapsibleTrigger
                className="ms-auto inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-medium text-foreground/80 hover:bg-muted hover:text-foreground disabled:opacity-50"
                data-tool-schema-toggle
                disabled={!schema}
              >
                Inferred schema{schema ? ` (${flat.length})` : ''}
                <ChevronDownIcon className={cn('size-3.5 transition-transform', schemaOpen && 'rotate-180')} />
              </CollapsibleTrigger>
            </div>
            <CollapsiblePanel>
              {schema && (
                <div className="grid grid-cols-1 gap-4 border-t p-3 sm:p-4 lg:grid-cols-2" data-tool-schema>
                  <CodeBlock code={withBrand(schemaCode(schema))} label="fields.ts" lang="typescript" />
                  <div className="min-w-0 overflow-x-auto rounded-xl border">
                    <table className="w-full text-left text-xs">
                      <thead className="border-b font-mono text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-normal">field</th>
                          <th className="px-3 py-2 font-normal">kind</th>
                          <th className="px-3 py-2 font-normal">seen</th>
                        </tr>
                      </thead>
                      <tbody>
                        {flat.map((fd) => (
                          <tr className="border-b last:border-b-0" key={fd.path}>
                            <td className="px-3 py-2 font-mono">{fd.path}</td>
                            <td className="px-3 py-2">
                              <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono">{fd.kind}</span>
                            </td>
                            <td className="max-w-64 truncate px-3 py-2 text-muted-foreground">
                              {[fd.operators.join(', '), fd.values.length ? fd.values.slice(0, 4).map((v) => JSON.stringify(v)).join(', ') : ''].filter(Boolean).join(' · ') || '—'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <p className="border-t px-3 py-2 text-muted-foreground leading-snug">
                      Kinds come from the values: numbers, booleans, ISO dates and times, lists (multi-value fields) and nested arrays. Every operator the input uses is allowed.
                    </p>
                  </div>
                </div>
              )}
            </CollapsiblePanel>
          </Collapsible>
        </div>
      </section>

      <section className="grid grid-cols-1 border-b lg:grid-cols-2 lg:divide-x">
        <div className="flex flex-col gap-4 border-b px-4 py-10 sm:px-8 lg:border-b-0">
          <h2 className="font-semibold text-2xl tracking-[-0.02em]">How it converts</h2>
          <div className="flex max-w-xl flex-col gap-3 text-muted-foreground leading-relaxed">{notes}</div>
        </div>
        <div className="flex min-w-0 flex-col gap-4 px-4 py-10 sm:px-8">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="font-semibold text-2xl tracking-[-0.02em]">Use it in your app</h2>
            <span className="font-mono text-muted-foreground text-xs">follows your input and settings</span>
          </div>
          <p className="max-w-xl text-muted-foreground leading-relaxed">
            The converter is qnot's codecs. Declare the fields once and the same two calls run on your server or in the browser, typed end to end.
          </p>
          {snippet ? (
            <CodeBlock className="bg-card" code={snippet} lang="typescript" />
          ) : (
            <div className="rounded-xl border border-dashed p-6 text-center text-muted-foreground text-sm">The snippet appears once the input converts.</div>
          )}
        </div>
      </section>
    </>
  );
}
