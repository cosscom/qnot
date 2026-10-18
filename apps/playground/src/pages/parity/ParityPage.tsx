import { ArrowRightIcon, CircleCheckIcon, CircleDashedIcon, CpuIcon, GaugeIcon, HistoryIcon, LayersIcon, PackageIcon, PlayIcon, SquareFunctionIcon, SplitIcon } from 'lucide-react';
import { useMemo, type ReactNode } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Sheet, SheetDescription, SheetHeader, SheetPanel, SheetPopup, SheetTitle } from '@/components/ui/sheet';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { DEMOS, demoFor } from './demos';
import { parseParity, type Status } from './parse';

/** Head-to-head numbers from the benchmark harness (bench/), at 1000 rules unless noted. */
export interface ParityBench {
  bundleKb: { trawlnet: number; raqb: number };
  keystrokeMs: { trawlnet: number; raqb: number };
  mountMs: { trawlnet: number; raqb: number };
  heapMb: { trawlnet: number; raqb: number };
}

/** Render `inline code` spans in a markdown cell. */
function Inline({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <>
      {parts.map((p, i) =>
        p.startsWith('`') ? (
          <code key={i} className="rounded bg-muted px-1 py-0.5 font-mono text-[12px]">
            {p.slice(1, -1)}
          </code>
        ) : (
          <span key={i}>{p.replace(/\*\*/g, '')}</span>
        ),
      )}
    </>
  );
}

const STATUS: Record<Status, { label: string; variant: 'success' | 'warning' | 'secondary'; icon: ReactNode }> = {
  done: { label: 'Done', variant: 'success', icon: <CircleCheckIcon className="size-3" /> },
  progress: { label: 'In progress', variant: 'warning', icon: <CircleDashedIcon className="size-3" /> },
  different: { label: 'By design', variant: 'secondary', icon: <SplitIcon className="size-3" /> },
};

function Compare({ icon, title, unit, a, b, lowerIsBetter = true, note }: { icon: ReactNode; title: string; unit: string; a: number; b: number; lowerIsBetter?: boolean; note: string }) {
  const max = Math.max(a, b);
  const factor = lowerIsBetter ? b / a : a / b;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border bg-card p-4" data-bench={title}>
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        {icon}
        {title}
        <Badge variant="success" className="ms-auto">
          {factor >= 10 ? Math.round(factor) : factor.toFixed(1)}× {lowerIsBetter ? 'less' : 'more'}
        </Badge>
      </div>
      {[
        ['trawlnet', a, 'bg-primary'],
        ['RAQB', b, 'bg-muted-foreground/40'],
      ].map(([name, v, color]) => (
        <div key={name as string} className="flex items-center gap-3">
          <span className="w-16 text-sm">{name}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
            <div className={cn('h-full rounded-full', color as string)} style={{ width: `${Math.max(3, ((v as number) / max) * 100)}%` }} />
          </div>
          <span className="w-20 text-end font-medium text-sm tabular-nums">
            {v as number} {unit}
          </span>
        </div>
      ))}
      <p className="text-muted-foreground text-xs">{note}</p>
    </div>
  );
}

function Extra({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 rounded-2xl border bg-card p-4">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/50 [&_svg]:size-4">{icon}</span>
      <div>
        <div className="font-medium text-sm">{title}</div>
        <div className="text-muted-foreground text-xs leading-relaxed">{children}</div>
      </div>
    </div>
  );
}

/**
 * The RAQB feature-parity matrix with a live demo per row. Pure: give it the markdown and bench
 * numbers; `demoId` (from the URL) opens a demo, `onOpenDemo` navigates.
 */
export function ParityPage({ markdown, bench, demoId, onOpenDemo }: { markdown: string; bench: ParityBench; demoId?: string; onOpenDemo: (id: string | null) => void }) {
  const doc = useMemo(() => parseParity(markdown), [markdown]);
  const rows = doc.sections.flatMap((s) => s.rows);
  const counts = { done: rows.filter((r) => r.status === 'done').length, progress: rows.filter((r) => r.status === 'progress').length, different: rows.filter((r) => r.status === 'different').length };
  const demo = DEMOS.find((d) => d.id === demoId);

  return (
    <main className="mx-auto flex max-w-6xl flex-col gap-8 p-4 sm:p-8">
      <header className="flex flex-col gap-3">
        <Badge variant="outline" className="w-fit">
          react-awesome-query-builder 6.6 → trawlnet
        </Badge>
        <h1 className="font-semibold text-3xl tracking-tight">{doc.title || 'Feature parity'}</h1>
        <p className="max-w-3xl text-muted-foreground">
          Every feature in RAQB's README and CONFIG docs, mapped to its trawlnet equivalent. Each row has a live demo built with coss ui on the same hooks your app would use.
        </p>
        <div className="flex flex-wrap gap-2 text-sm">
          <Badge variant="success" data-count="done">
            {counts.done} done
          </Badge>
          {counts.progress > 0 && (
            <Badge variant="warning" data-count="progress">
              {counts.progress} marked in progress
            </Badge>
          )}
          <Badge variant="secondary">{counts.different} different by design</Badge>
          <Badge variant="outline">{DEMOS.length} live demos</Badge>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        <h2 className="font-semibold text-lg">What you get on top</h2>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <Compare icon={<PackageIcon className="size-3.5" />} title="Bundle (gzip, excl. React)" unit="KB" a={bench.bundleKb.trawlnet} b={bench.bundleKb.raqb} note="Core + React bindings vs @react-awesome-query-builder/ui, same bench page." />
          <Compare icon={<GaugeIcon className="size-3.5" />} title="Keystroke at 1000 rules" unit="ms" a={bench.keystrokeMs.trawlnet} b={bench.keystrokeMs.raqb} note="Median latency typing into one value. Per-node subscriptions keep it O(1)." />
          <Compare icon={<CpuIcon className="size-3.5" />} title="Mount 1000 rules" unit="ms" a={bench.mountMs.trawlnet} b={bench.mountMs.raqb} note="Cold first render in a fresh page, headless Chromium." />
          <Compare icon={<LayersIcon className="size-3.5" />} title="Heap at 1000 rules" unit="MB" a={bench.heapMb.trawlnet} b={bench.heapMb.raqb} note="Retained JS heap after mount, forced GC." />
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <Extra icon={<HistoryIcon />} title="Undo / redo in the store">
            Every edit is undoable; keystrokes in one value merge into a single step.{' '}
            <button type="button" className="underline" onClick={() => onOpenDemo('undo')}>
              Try it
            </button>
          </Extra>
          <Extra icon={<SquareFunctionIcon />} title="compile() and matches()">
            Evaluate queries in JS with typed rows; RAQB only exports.{' '}
            <button type="button" className="underline" onClick={() => onOpenDemo('compile')}>
              Try it
            </button>
          </Extra>
          <Extra icon={<LayersIcon />} title="5 frameworks, any UI kit">
            Headless core with React, Vue, Svelte, Solid and vanilla DOM bindings. RAQB is React-only.{' '}
            <a href="#/" className="underline">
              See them side by side
            </a>
          </Extra>
        </div>
      </section>

      {doc.sections.map((section) => (
        <section key={section.title} className="flex flex-col gap-3" data-section={section.title}>
          <h2 className="font-semibold text-lg">{section.title}</h2>
          {section.paragraphs.map((p, i) => (
            <p key={i} className="max-w-3xl text-muted-foreground text-sm leading-relaxed">
              <Inline text={p} />
            </p>
          ))}
          {section.rows.length > 0 && (
            <div className="overflow-hidden rounded-2xl border bg-card">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[34%]">RAQB</TableHead>
                    <TableHead className="w-[40%]">trawlnet</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-end">Demo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {section.rows.map((row) => {
                    const target = demoFor(row.raqb);
                    const s = STATUS[row.status];
                    return (
                      <TableRow key={row.raqb} data-parity-row>
                        <TableCell className="whitespace-normal align-top text-sm">
                          <Inline text={row.raqb} />
                        </TableCell>
                        <TableCell className="whitespace-normal align-top text-sm">
                          <Inline text={row.trawlnet} />
                        </TableCell>
                        <TableCell className="align-top">
                          <Badge variant={s.variant}>
                            {s.icon}
                            {s.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-end align-top">
                          {target ? (
                            <Button size="xs" variant="outline" onClick={() => onOpenDemo(target)} data-try={target}>
                              <PlayIcon /> Try it
                            </Button>
                          ) : (
                            <span className="text-muted-foreground text-xs">n/a</span>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </section>
      ))}

      <Sheet open={!!demo} onOpenChange={(open) => !open && onOpenDemo(null)}>
        <SheetPopup side="right" className="w-full max-w-[min(100vw,960px)]">
          {demo && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  {demo.title}
                  <ArrowRightIcon className="size-4 text-muted-foreground" />
                  <code className="font-mono text-muted-foreground text-xs">#/parity/{demo.id}</code>
                </SheetTitle>
                <SheetDescription>{demo.blurb}</SheetDescription>
              </SheetHeader>
              <SheetPanel data-demo={demo.id}>
                <demo.Component key={demo.id} />
              </SheetPanel>
            </>
          )}
        </SheetPopup>
      </Sheet>
    </main>
  );
}
