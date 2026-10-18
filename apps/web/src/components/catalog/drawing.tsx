import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/*
 * Pieces for catalog drawings in the coss.com/ui manner: panels, skeleton bars, chips, selects,
 * toggles and buttons, drawn with hairlines and muted fills so they read as diagrams, not UI.
 * Compose them per example, e.g.
 *
 *   <Sketch.Panel>
 *     <Sketch.Row><Sketch.Select w={20} /><Sketch.Select w={14} /><Sketch.Chip w={10} active /></Sketch.Row>
 *   </Sketch.Panel>
 */

type Tone = 'ink' | 'muted' | 'soft' | 'accent';

const BAR: Record<Tone, string> = {
  ink: 'bg-foreground/70',
  muted: 'bg-foreground/25',
  soft: 'bg-foreground/12',
  accent: 'bg-teal-500 dark:bg-teal-400',
};

/** A line of "text": `w` in quarter-rem units (Tailwind spacing). */
function Bar({ w = 16, tone = 'muted', className }: { w?: number; tone?: Tone; className?: string }) {
  return <span className={cn('block h-1.5 shrink-0 rounded-full', BAR[tone], className)} style={{ width: `calc(var(--spacing) * ${w})` }} />;
}

/** A raised surface: a card, a popover, a form. */
function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('flex flex-col gap-2.5 rounded-xl border bg-background p-3 shadow-xs/5', className)}>{children}</div>;
}

function Row({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn('flex items-center gap-1.5', className)}>{children}</div>;
}

/** A select / input pill with a chevron. */
function Select({ w = 16, tone = 'muted', className }: { w?: number; tone?: Tone; className?: string }) {
  return (
    <span className={cn('flex h-6 shrink-0 items-center justify-between gap-2 rounded-md border bg-background px-2', className)} style={{ width: `calc(var(--spacing) * ${w + 8})` }}>
      <Bar tone={tone} w={w - 2} />
      <svg aria-hidden className="size-2.5 shrink-0 text-foreground/40" fill="none" viewBox="0 0 10 10">
        <path d="M3 4l2 2 2-2" stroke="currentColor" strokeLinecap="round" strokeWidth="1.2" />
      </svg>
    </span>
  );
}

/** A removable chip, e.g. a selected value. */
function Chip({ w = 8, active, className }: { w?: number; active?: boolean; className?: string }) {
  return (
    <span className={cn('flex h-5 shrink-0 items-center gap-1 rounded-[5px] border px-1.5', active ? 'border-teal-500/40 bg-teal-500/10' : 'bg-muted/60', className)}>
      <Bar tone={active ? 'accent' : 'muted'} w={w} />
      <svg aria-hidden className="size-2 text-foreground/40" fill="none" viewBox="0 0 8 8">
        <path d="M2 2l4 4M6 2L2 6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.1" />
      </svg>
    </span>
  );
}

function Toggle({ on }: { on?: boolean }) {
  return (
    <span className={cn('relative inline-flex h-3.5 w-6 shrink-0 rounded-full', on ? 'bg-foreground/80' : 'bg-foreground/15')}>
      <span className={cn('absolute top-0.5 size-2.5 rounded-full bg-background shadow-xs transition-all', on ? 'left-3' : 'left-0.5')} />
    </span>
  );
}

/** A segmented control (all / any / none). `active` is the selected index. */
function Segmented({ items = 3, active = 0 }: { items?: number; active?: number }) {
  return (
    <span className="flex h-6 shrink-0 items-center gap-0.5 rounded-md bg-muted p-0.5">
      {Array.from({ length: items }, (_, i) => (
        <span className={cn('flex h-full items-center rounded-[4px] px-1.5', i === active && 'bg-background shadow-xs')} key={i}>
          <Bar tone={i === active ? 'ink' : 'muted'} w={4} />
        </span>
      ))}
    </span>
  );
}

function Button({ solid, w = 10, className }: { solid?: boolean; w?: number; className?: string }) {
  return (
    <span className={cn('flex h-6 shrink-0 items-center justify-center rounded-md px-2', solid ? 'bg-foreground' : 'border bg-background', className)}>
      <span className={cn('block h-1.5 rounded-full', solid ? 'bg-background/80' : 'bg-foreground/30')} style={{ width: `calc(var(--spacing) * ${w})` }} />
    </span>
  );
}

function Dot({ tone = 'muted' }: { tone?: Tone }) {
  return <span className={cn('block size-2 shrink-0 rounded-full', BAR[tone])} />;
}

function Divider() {
  return <span className="-mx-3 block h-px bg-border" />;
}

/** A little grid of "results" (rows of a table, products, users…). */
function Grid({ cols = 3, rows = 2, accent = -1 }: { cols?: number; rows?: number; accent?: number }) {
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {Array.from({ length: cols * rows }, (_, i) => (
        <span className={cn('flex h-9 flex-col justify-end gap-1 rounded-md border p-1.5', i === accent ? 'border-teal-500/40 bg-teal-500/10' : 'bg-muted/40')} key={i}>
          <Bar tone={i === accent ? 'accent' : 'muted'} w={6} />
        </span>
      ))}
    </div>
  );
}

/** Code lines, e.g. an exported SQL query. */
function Code({ lines = [14, 20, 10] }: { lines?: number[] }) {
  return (
    <div className="flex flex-col gap-1.5 rounded-lg border bg-sidebar p-2.5 font-mono">
      {lines.map((w, i) => (
        <span className="flex items-center gap-1.5" key={i}>
          <span className="w-2 text-[0.5rem] text-foreground/30 leading-none">{i + 1}</span>
          <Bar tone={i === 0 ? 'ink' : 'muted'} w={w} />
        </span>
      ))}
    </div>
  );
}

export const Sketch = { Bar, Panel, Row, Select, Chip, Toggle, Segmented, Button, Dot, Divider, Grid, Code };
