import { ScrollArea } from '@/components/ui/scroll-area';
import { benchData, libInfo, type BenchPoint, type BenchSize, type LibId } from '@/lib/bench-series';
import { suite } from '@/lib/bench-suite';
import { cn } from '@/lib/utils';

// Benchmark tables drawn like the landing page's: numbers first, then a thin bar against the
// largest value in the column. Every chart is a real <table>, so it reads without the bars.

export type Metric = 'mount' | 'keystroke' | 'add' | 'heap' | 'js' | 'css' | 'dom';

export const METRICS: Record<Metric, { label: string; unit: string }> = {
  mount: { label: 'First render', unit: 'ms' },
  keystroke: { label: 'Keystroke', unit: 'ms' },
  add: { label: 'Add a rule', unit: 'ms' },
  heap: { label: 'Memory', unit: 'MB' },
  js: { label: 'JS, gzipped', unit: 'KB' },
  css: { label: 'CSS, gzipped', unit: 'KB' },
  dom: { label: 'DOM nodes', unit: '' },
};

export function metricValue(id: LibId, metric: Metric, size: BenchSize = 1000): number | null {
  const d = benchData();
  if (metric === 'js' || metric === 'css') return d.sizes[id][metric];
  return (d.series[id][size] as BenchPoint)[metric];
}

const fmt = (v: number) => (v >= 1000 ? v.toLocaleString('en-US', { maximumFractionDigits: 0 }) : String(v));

function Bar({ value, max, us }: { value: number; max: number; us?: boolean }) {
  return (
    <span aria-hidden className="mt-2 block h-1 w-full max-w-36 rounded-full bg-foreground/8">
      <span className={cn('block h-full rounded-full', us ? 'bg-teal-500 dark:bg-teal-400' : 'bg-foreground/30')} style={{ width: `${Math.max(2, (value / max) * 100)}%` }} />
    </span>
  );
}

function Value({ value, unit, us, max }: { value: number | null; unit: string; us?: boolean; max: number }) {
  if (value === null) return <span className="font-mono text-muted-foreground">n/a</span>;
  return (
    <>
      <span className="flex items-baseline gap-1 tabular-nums">
        <span className={cn('font-heading font-semibold text-lg', !us && 'text-foreground/80')}>{fmt(value)}</span>
        {unit && <span className="font-mono text-muted-foreground text-xs">{unit}</span>}
      </span>
      <Bar max={max} us={us} value={value} />
    </>
  );
}

function LibCell({ id }: { id: LibId }) {
  const lib = libInfo(id);
  return (
    <th className="px-4 py-4 text-left font-normal sm:px-8" scope="row">
      <span className="flex items-baseline gap-2">
        <span className={cn('font-medium text-base', !lib.us && 'text-foreground/80')}>{lib.name}</span>
        <span className="font-mono text-muted-foreground text-xs">{lib.version}</span>
      </span>
      <span className="font-mono text-muted-foreground text-xs">{lib.pkg}</span>
    </th>
  );
}

/** Rows are libraries, columns are metrics, all at one tree size. */
export function BenchTable({ ids, size = 1000, metrics = ['mount', 'keystroke', 'add', 'heap', 'js'], caption }: { ids: readonly LibId[]; size?: BenchSize; metrics?: Metric[]; caption: string }) {
  const max = Object.fromEntries(metrics.map((m) => [m, Math.max(...ids.map((id) => metricValue(id, m, size) ?? 0))])) as Record<Metric, number>;
  return (
    <ScrollArea clampContentMinWidth={false} scrollFade>
      <table className="w-full min-w-[52rem] border-collapse text-sm">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b">
            <th className="px-4 py-3 text-left font-mono font-normal text-muted-foreground text-xs sm:px-8" scope="col">
              library
            </th>
            {metrics.map((m) => (
              <th className="px-4 py-3 text-left font-mono font-normal text-muted-foreground text-xs" key={m} scope="col">
                {METRICS[m].label.toLowerCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ids.map((id) => {
            const us = libInfo(id).us;
            return (
              <tr className={cn('border-b last:border-b-0', us && 'bg-muted/30')} key={id}>
                <LibCell id={id} />
                {metrics.map((m) => (
                  <td className="px-4 py-4 align-top" key={m}>
                    <Value max={max[m]} unit={METRICS[m].unit} us={us} value={metricValue(id, m, size)} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollArea>
  );
}

/** A footnote under a benchmark table: the run, the machine, the method in one breath. */
export function BenchNote({ children }: { children?: React.ReactNode }) {
  const { date } = benchData();
  const env = suite().env;
  return (
    <p className="border-t px-4 py-5 text-muted-foreground text-sm leading-relaxed sm:px-8">
      Run of {date}: {env.cpu}, Chromium {env.chromium.split('.')[0]} via Playwright {env.playwright?.split('.').slice(0, 2).join('.')}, production builds, no CPU throttling. Medians of fresh pages (5 to 9 per size); the tree is 10 fields in groups of 10 rules. JS is
      gzipped and excludes React for React libraries (jQuery is included). Lower is better. {children}
    </p>
  );
}
