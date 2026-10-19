// One abstract drawing per example for the catalog cards, built from <Sketch> pieces so each reads
// as a diagram of that example's UI rather than a screenshot.
import type { ReactNode } from 'react';
import { Sketch } from '@/components/catalog';
import { cn } from '@/lib/utils';

/** A short vertical hairline joining two stacked panels (the routing-form timeline). */
const Link = () => <span aria-hidden className="ms-4 block h-3 w-px bg-border" />;

/** A tiny icon box, like the step markers in the routing forms and workflow examples. */
const Mark = ({ accent }: { accent?: boolean }) => (
  <span className={cn('flex size-4 shrink-0 items-center justify-center rounded-[4px] border bg-background', accent && 'border-teal-500/40')}>
    <span className={cn('size-1.5 rounded-full', accent ? 'bg-teal-500 dark:bg-teal-400' : 'bg-foreground/30')} />
  </span>
);

const RoutingForms = () => (
  <div className="flex flex-col">
    <Sketch.Panel>
      <Sketch.Row>
        <Mark accent />
        <Sketch.Bar tone="ink" w={3} />
        <Sketch.Segmented active={0} />
        <Sketch.Bar w={12} />
      </Sketch.Row>
      <Sketch.Row>
        <Sketch.Select w={11} />
        <Sketch.Select tone="soft" w={5} />
        <Sketch.Select w={8} />
      </Sketch.Row>
    </Sketch.Panel>
    <Link />
    <Sketch.Panel>
      <Sketch.Row>
        <Mark />
        <Sketch.Bar tone="ink" w={8} />
      </Sketch.Row>
      <Sketch.Row>
        <Sketch.Select w={10} />
        <Sketch.Select tone="accent" w={13} />
      </Sketch.Row>
    </Sketch.Panel>
    <Link />
    <Sketch.Panel>
      <Sketch.Row className="justify-between">
        <Sketch.Row>
          <Mark />
          <Sketch.Bar w={20} />
        </Sketch.Row>
        <Sketch.Toggle on />
      </Sketch.Row>
    </Sketch.Panel>
  </div>
);

const IssueRow = ({ w, accent }: { w: number; accent?: boolean }) => (
  <Sketch.Row className="border-b py-1.5 last:border-b-0">
    <Sketch.Dot tone={accent ? 'accent' : 'soft'} />
    <Sketch.Bar tone="soft" w={4} />
    <Sketch.Bar tone={accent ? 'ink' : 'muted'} w={w} />
    <span className="ms-auto size-3 rounded-full bg-foreground/15" />
  </Sketch.Row>
);

const LinearFilters = () => (
  <div className="flex flex-col gap-3">
    <Sketch.Row className="flex-wrap">
      <Sketch.Chip active w={14} />
      <Sketch.Chip w={10} />
      <Sketch.Button w={6} />
    </Sketch.Row>
    <Sketch.Panel className="gap-0 py-1.5">
      <IssueRow accent w={20} />
      <IssueRow accent w={16} />
      <IssueRow w={22} />
      <IssueRow w={12} />
    </Sketch.Panel>
  </div>
);

const Step = ({ children }: { children: ReactNode }) => <Sketch.Panel className="gap-2 p-2.5">{children}</Sketch.Panel>;

const Workflow = () => (
  <div className="flex flex-col">
    <Step>
      <Sketch.Row>
        <Mark accent />
        <Sketch.Bar tone="ink" w={6} />
        <Sketch.Select w={12} />
      </Sketch.Row>
    </Step>
    <Link />
    <Step>
      <Sketch.Row>
        <Mark />
        <Sketch.Bar tone="ink" w={4} />
        <Sketch.Segmented active={0} />
      </Sketch.Row>
      <Sketch.Row>
        <Sketch.Select w={9} />
        <Sketch.Select tone="soft" w={5} />
        <Sketch.Select w={7} />
      </Sketch.Row>
    </Step>
    <Link />
    <Step>
      <Sketch.Row>
        <Mark />
        <Sketch.Bar tone="ink" w={5} />
        <Sketch.Select tone="accent" w={10} />
      </Sketch.Row>
    </Step>
  </div>
);

const SavedViews = () => (
  <div className="flex gap-2.5">
    <div className="flex w-16 shrink-0 flex-col gap-2 pt-1">
      {[10, 12, 9, 11].map((w, i) => (
        <Sketch.Row className={cn('rounded-md px-1.5 py-1', i === 1 && 'bg-foreground/8')} key={i}>
          <Sketch.Bar tone={i === 1 ? 'ink' : 'muted'} w={w} />
        </Sketch.Row>
      ))}
    </div>
    <Sketch.Panel className="min-w-0 flex-1">
      <Sketch.Row className="justify-between">
        <Sketch.Bar tone="ink" w={12} />
        <Sketch.Row>
          <span className="text-[0.625rem] text-foreground/40 leading-none">↶ ↷</span>
          <Sketch.Button w={5} />
        </Sketch.Row>
      </Sketch.Row>
      <span className="flex flex-col gap-1 rounded-md bg-muted/60 p-1.5">
        <Sketch.Bar w={26} />
        <Sketch.Bar w={16} />
      </span>
      <Sketch.Grid cols={3} rows={2} />
    </Sketch.Panel>
  </div>
);

const ProductFilters = () => (
  <div className="flex flex-col gap-3">
    <Sketch.Panel className="gap-2">
      <Sketch.Row>
        <Sketch.Select w={8} />
        <Sketch.Select tone="soft" w={5} />
        <Sketch.Chip active w={6} />
        <Sketch.Chip w={6} />
      </Sketch.Row>
      <Sketch.Row>
        <Sketch.Select w={8} />
        <Sketch.Select tone="soft" w={5} />
        <Sketch.Bar w={10} />
      </Sketch.Row>
    </Sketch.Panel>
    <Sketch.Grid accent={4} cols={4} rows={2} />
  </div>
);

const Segments = () => (
  <div className="flex flex-col gap-2.5">
    <div className="grid grid-cols-2 gap-2">
      <Sketch.Panel className="gap-2 p-2.5">
        <Sketch.Bar tone="soft" w={8} />
        <span className="font-heading font-semibold text-foreground/80 text-lg leading-none">852</span>
        <span className="block h-1.5 overflow-hidden rounded-full bg-foreground/10">
          <span className="block h-full w-1/5 rounded-full bg-teal-500 dark:bg-teal-400" />
        </span>
      </Sketch.Panel>
      <Sketch.Panel className="gap-2 p-2.5">
        <Sketch.Bar tone="soft" w={10} />
        <Sketch.Bar tone="ink" w={14} />
        <Sketch.Bar w={8} />
      </Sketch.Panel>
    </div>
    <Sketch.Code lines={[10, 24, 18, 12]} />
  </div>
);

const FeatureFlags = () => (
  <div className="flex flex-col gap-3">
    <Sketch.Panel className="gap-2.5">
      <Sketch.Row className="justify-between">
        <Sketch.Bar tone="ink" w={14} />
        <Sketch.Toggle on />
      </Sketch.Row>
      <span className="relative block h-2 rounded-full bg-foreground/10">
        <span className="absolute inset-y-0 left-0 w-[40%] rounded-full bg-teal-500 dark:bg-teal-400" />
        <span className="absolute top-1/2 left-[40%] size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border bg-background shadow-xs" />
      </span>
      <Sketch.Row className="justify-between">
        <Sketch.Bar tone="soft" w={6} />
        <Sketch.Bar tone="muted" w={4} />
      </Sketch.Row>
    </Sketch.Panel>
    <div className="grid grid-cols-10 gap-1.5">
      {Array.from({ length: 30 }, (_, i) => {
        const inSegment = [1, 3, 4, 8, 11, 12, 15, 19, 20, 23, 26, 28].includes(i);
        const on = inSegment && i % 3 !== 2;
        return <span className={cn('aspect-square rounded-full', on ? 'bg-teal-500 dark:bg-teal-400' : inSegment ? 'bg-foreground/30' : 'bg-foreground/10')} key={i} />;
      })}
    </div>
  </div>
);

const Alerting = () => (
  <div className="flex flex-col gap-2.5">
    <Sketch.Panel className="gap-0 p-2">
      <svg aria-hidden className="h-16 w-full" fill="none" preserveAspectRatio="none" viewBox="0 0 200 60">
        <line className="text-red-500/60" stroke="currentColor" strokeDasharray="3 3" strokeWidth="1" x1="0" x2="200" y1="18" y2="18" />
        <polyline className="text-foreground/40" points="0,44 18,40 36,46 54,34 72,38 90,30 108,36 126,24 144,12 162,16 180,28 200,22" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.5" />
        <circle className="text-red-500" cx="144" cy="12" fill="currentColor" r="3" />
      </svg>
    </Sketch.Panel>
    <Sketch.Panel className="gap-1.5 p-2.5">
      {[true, false, false, true].map((firing, i) => (
        <Sketch.Row className={cn('rounded-md px-1.5 py-1', firing && 'bg-red-500/10')} key={i}>
          <span className={cn('size-2 rounded-full', firing ? 'bg-red-500' : 'bg-foreground/20')} />
          <Sketch.Bar tone={firing ? 'ink' : 'muted'} w={10} />
          <Sketch.Bar className="ms-auto" tone="soft" w={6} />
          <Sketch.Bar tone="soft" w={5} />
        </Sketch.Row>
      ))}
    </Sketch.Panel>
  </div>
);

const AccessPolicy = () => (
  <div className="flex items-center gap-2">
    <Sketch.Panel className="min-w-0 flex-1 gap-2 p-2.5">
      {[0, 1, 2].map((i) => (
        <Sketch.Row key={i}>
          <span className={cn('rounded-[3px] px-1 font-mono text-[0.5rem] leading-3', i === 1 ? 'bg-red-500/15 text-red-600 dark:text-red-400' : 'bg-teal-500/15 text-teal-700 dark:text-teal-300')}>
            {i === 1 ? 'deny' : 'allow'}
          </span>
          <Sketch.Bar w={[14, 10, 12][i]} />
        </Sketch.Row>
      ))}
    </Sketch.Panel>
    <span className="text-foreground/40">→</span>
    <Sketch.Panel className="items-center gap-1.5 p-2.5">
      <span className="flex size-7 items-center justify-center rounded-full border border-teal-500/40 bg-teal-500/10 text-teal-600 text-xs dark:text-teal-300">✓</span>
      <Sketch.Bar tone="ink" w={8} />
    </Sketch.Panel>
  </div>
);

const RqbDropin = () => (
  <div className="flex items-center gap-2">
    <Sketch.Panel className="min-w-0 flex-1 gap-2 p-2.5">
      <Sketch.Row>
        <Sketch.Select w={6} />
        <Sketch.Select tone="soft" w={4} />
      </Sketch.Row>
      <Sketch.Row>
        <Sketch.Select w={6} />
        <Sketch.Chip active w={5} />
      </Sketch.Row>
    </Sketch.Panel>
    <span className="font-mono text-foreground/40 text-xs">⇄</span>
    <div className="min-w-0 flex-1">
      <Sketch.Code lines={[8, 12, 10, 6]} />
    </div>
  </div>
);

const ServerSide = () => (
  <div className="relative flex flex-col items-center">
    <Sketch.Panel className="w-3/4 gap-2 p-2.5">
      <Sketch.Row>
        <Sketch.Select w={7} />
        <Sketch.Select tone="soft" w={4} />
        <Sketch.Bar w={6} />
      </Sketch.Row>
    </Sketch.Panel>
    <svg aria-hidden className="h-6 w-full text-border" fill="none" viewBox="0 0 200 24">
      <path d="M100 0v8M100 8H34v16M100 8v16M100 8h66v16" stroke="currentColor" strokeWidth="1" />
    </svg>
    <div className="grid w-full grid-cols-3 gap-1.5">
      {[
        [10, 8, 12],
        [8, 12, 6],
        [12, 6, 9],
      ].map((lines, i) => (
        <Sketch.Code key={i} lines={lines} />
      ))}
    </div>
  </div>
);

export const SKETCHES: Record<string, () => ReactNode> = {
  'routing-forms': RoutingForms,
  'linear-filters': LinearFilters,
  workflow: Workflow,
  'saved-views': SavedViews,
  'product-filters': ProductFilters,
  segments: Segments,
  'feature-flags': FeatureFlags,
  alerting: Alerting,
  'access-policy': AccessPolicy,
  'rqb-dropin': RqbDropin,
  'server-side': ServerSide,
};
