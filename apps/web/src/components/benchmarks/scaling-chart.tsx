'use client';

// Size-vs-time curves on log–log axes, with a metric switcher, toggleable series, a tooltip with
// every library's number at the hovered size, and a table view of the same data.
//
// bklit's LineChart is a time series with linear scales, so both axes are log-transformed here:
// x is log10(size) carried as a Date, y is log10(value) shifted so the lowest decade sits at 0.
// The labels (LogAxes) and the tooltip show the real numbers.
import { curveMonotoneX } from '@visx/curve';
import { useMemo, useState } from 'react';
import { Grid } from '@/components/charts/grid';
import { Line, LineChart } from '@/components/charts/line-chart';
import { ChartTooltip } from '@/components/charts/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { LogAxes } from './chart-axes';
import { fmt, fmtCount, fmtSize, fmtTick, type Unit } from './format';

export interface ChartSeries {
  id: string;
  label: string;
  color: string;
  dashed?: boolean;
  us?: boolean;
}

export interface Cell {
  /** Median. */
  v: number | null;
  /** p25 / p75 (or p95 where noted). */
  lo?: number;
  hi?: number;
  /** Why there is no number: "skipped …", "failed …", "n/a …". */
  why?: string;
}

export interface ScalingMetric {
  id: string;
  label: string;
  unit: Unit;
  /** One line under the chart: what is measured. */
  note: string;
  /** Per series, one cell per size. */
  cells: Record<string, Cell[]>;
  /** What lo/hi mean in the table (default p25–p75). */
  range?: string;
}

const LOG_SCALE = 1e6; // log10(size) → epoch ms for the time scale

export function ScalingChart({ caption, sizes, series, metrics, height = 'h-72 sm:h-96' }: { caption: string; sizes: number[]; series: ChartSeries[]; metrics: ScalingMetric[]; height?: string }) {
  const [metricId, setMetricId] = useState(metrics[0]!.id);
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const [hidden, setHidden] = useState<Set<string>>(() => new Set());
  const metric = metrics.find((m) => m.id === metricId) ?? metrics[0]!;
  const visible = series.filter((s) => !hidden.has(s.id));

  const { data, yTicks } = useMemo(() => {
    const all = visible.flatMap((s) => metric.cells[s.id]?.map((c) => c.v).filter((v): v is number => v != null && v > 0) ?? []);
    const lo = all.length ? Math.floor(Math.log10(Math.min(...all))) : 0;
    const hi = all.length ? Math.ceil(Math.log10(Math.max(...all))) : 1;
    const rows = sizes.map((n, i) => {
      const row: Record<string, unknown> = { date: new Date(Math.round(Math.log10(n) * LOG_SCALE)), size: n };
      for (const s of visible) {
        const v = metric.cells[s.id]?.[i]?.v;
        if (v != null && v > 0) row[s.id] = Math.log10(v) - lo;
      }
      return row;
    });
    // Decade ticks; with few decades add 2× and 5× so the axis still reads.
    const decades = hi - lo;
    const steps = decades <= 2 ? [1, 2, 5] : [1];
    const ticks: { value: number; label: string }[] = [];
    for (let d = lo; d <= hi; d++) {
      for (const m of steps) {
        const real = m * 10 ** d;
        const t = Math.log10(real) - lo;
        if (t > hi - lo + 1e-9) continue;
        ticks.push({ value: t, label: fmtTick(Number(real.toPrecision(3)), metric.unit) });
      }
    }
    return { data: rows, yTicks: ticks };
  }, [metric, sizes, visible]);

  const toggle = (id: string) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(id)) next.delete(id);
      else if (series.length - next.size > 1) next.add(id);
      return next;
    });

  const missing = series.flatMap((s) => metric.cells[s.id]?.flatMap((c, i) => (c.v == null && c.why ? [`${s.label} at ${fmtCount(sizes[i]!)}: ${c.why}`] : [])) ?? []);

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        {metrics.length > 1 ? (
          <Tabs onValueChange={(v) => setMetricId(String(v))} value={metricId}>
            <ScrollArea className="max-w-full" clampContentMinWidth={false} scrollFade>
              <TabsList>
                {metrics.map((m) => (
                  <TabsTab key={m.id} value={m.id}>
                    {m.label}
                  </TabsTab>
                ))}
              </TabsList>
            </ScrollArea>
          </Tabs>
        ) : (
          <p className="font-medium">{metric.label}</p>
        )}
        <Tabs onValueChange={(v) => setView(v as 'chart' | 'table')} value={view}>
          <TabsList aria-label="View">
            <TabsTab value="chart">Chart</TabsTab>
            <TabsTab value="table">Table</TabsTab>
          </TabsList>
        </Tabs>
      </div>

      {view === 'chart' ? (
        <div className="px-2 pt-4 pb-2 sm:px-6">
          <Legend hidden={hidden} onToggle={toggle} series={series} />
          <figure aria-label={`${caption}: ${metric.label}`} className="mt-2">
            <LineChart animationDuration={700} aspectRatio="" className={height} data={data} margin={{ top: 16, right: 20, bottom: 34, left: 58 }} revealSignature={metric.id} yDomainTween={false}>
              <Grid fadeHorizontal={false} rowTickValues={yTicks.map((t) => t.value)} strokeDasharray="2,4" />
              {visible.map((s) => (
                <Line
                  curve={curveMonotoneX}
                  dashFromIndex={s.dashed ? 0 : undefined}
                  dashArray="5,4"
                  fadeEdges={false}
                  dataKey={s.id}
                  key={s.id}
                  showHighlight={false}
                  showMarkers
                  markers={{ radius: 3, fill: s.color, stroke: 'var(--chart-background)', strokeWidth: 1.5 }}
                  stroke={s.color}
                  strokeWidth={s.us ? 2.75 : 2}
                />
              ))}
              <LogAxes xLabels={sizes.map(fmtSize)} yTicks={yTicks} />
              <ChartTooltip
                content={({ point }) => <TooltipBody metric={metric} point={point} series={visible} sizes={sizes} />}
                dotSize={4}
                showDatePill={false}
              />
            </LineChart>
            <figcaption className="px-2 pt-1 font-mono text-muted-foreground text-xs sm:px-2">
              Both axes logarithmic · rules in the tree → · {metric.note}
            </figcaption>
          </figure>
        </div>
      ) : (
        <DataTable caption={`${caption}: ${metric.label}`} metric={metric} series={series} sizes={sizes} />
      )}

      {missing.length > 0 && (
        <ul className="flex flex-col gap-1 border-t px-4 py-4 font-mono text-muted-foreground text-xs sm:px-8">
          {missing.map((m) => (
            <li key={m}>{m}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Legend({ series, hidden, onToggle }: { series: ChartSeries[]; hidden?: Set<string>; onToggle?: (id: string) => void }) {
  return (
    <ul aria-label="Series" className="flex flex-wrap gap-x-1 gap-y-1 px-2">
      {series.map((s) => {
        const off = hidden?.has(s.id) ?? false;
        const swatch = (
          <svg aria-hidden className="shrink-0" height="8" width="18">
            <line stroke={s.color} strokeDasharray={s.dashed ? '4,3' : undefined} strokeLinecap="round" strokeWidth={s.us ? 3 : 2.25} x1="1.5" x2="16.5" y1="4" y2="4" />
          </svg>
        );
        return (
          <li key={s.id}>
            {onToggle ? (
              <button
                aria-pressed={!off}
                className={cn('inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-sm transition-opacity hover:bg-muted', off && 'opacity-40', s.us && 'font-medium')}
                onClick={() => onToggle(s.id)}
                type="button"
              >
                {swatch}
                {s.label}
              </button>
            ) : (
              <span className={cn('inline-flex items-center gap-1.5 px-2 py-1 text-sm', s.us && 'font-medium')}>
                {swatch}
                {s.label}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

function TooltipBody({ point, metric, series, sizes }: { point: Record<string, unknown>; metric: ScalingMetric; series: ChartSeries[]; sizes: number[] }) {
  const size = point.size as number;
  const i = sizes.indexOf(size);
  const rows = series
    .map((s) => ({ s, c: metric.cells[s.id]?.[i] }))
    .sort((a, b) => (a.c?.v ?? Number.POSITIVE_INFINITY) - (b.c?.v ?? Number.POSITIVE_INFINITY));
  return (
    <div className="flex min-w-48 flex-col gap-1.5 px-3 py-2.5">
      <p className="font-medium text-chart-tooltip-foreground text-sm">
        {metric.label} · {size.toLocaleString('en-US')} rules
      </p>
      <ul className="flex flex-col gap-1">
        {rows.map(({ s, c }) => (
          <li className="flex items-center justify-between gap-4 text-xs" key={s.id}>
            <span className="flex items-center gap-1.5 text-chart-tooltip-muted">
              <span aria-hidden className="size-2 rounded-full" style={{ background: s.color }} />
              {s.label}
            </span>
            <span className="font-mono text-chart-tooltip-foreground tabular-nums">{c?.v != null ? fmt(c.v, metric.unit) : c?.why ? c.why.split(':')[0]!.split(' (')[0] : '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function DataTable({ caption, metric, series, sizes }: { caption: string; metric: ScalingMetric; series: ChartSeries[]; sizes: number[] }) {
  return (
    <ScrollArea clampContentMinWidth={false} scrollFade>
      <table className="w-full min-w-[44rem] border-collapse text-sm">
        <caption className="px-4 pt-4 text-left font-mono text-muted-foreground text-xs sm:px-8">
          {caption}: {metric.label}, median ({metric.range ?? 'p25–p75'} below)
        </caption>
        <thead>
          <tr className="border-b">
            <th className="px-4 py-3 text-left font-mono font-normal text-muted-foreground text-xs sm:px-8" scope="col">
              library
            </th>
            {sizes.map((n) => (
              <th className="px-3 py-3 text-right font-mono font-normal text-muted-foreground text-xs" key={n} scope="col">
                {n.toLocaleString('en-US')}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {series.map((s) => (
            <tr className={cn('border-b last:border-b-0', s.us && 'bg-muted/30')} key={s.id}>
              <th className="sticky left-0 z-10 bg-background px-4 py-3 text-left font-normal sm:px-8" scope="row">
                <span className="flex items-center gap-2">
                  <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: s.color }} />
                  <span className={cn(s.us ? 'font-medium' : 'text-foreground/80')}>{s.label}</span>
                </span>
              </th>
              {sizes.map((n, i) => {
                const c = metric.cells[s.id]?.[i];
                return (
                  <td className="px-3 py-3 text-right align-top tabular-nums" key={n} title={c?.why}>
                    {c?.v != null ? (
                      <>
                        <span className="font-mono">{fmt(c.v, metric.unit)}</span>
                        {c.lo != null && c.hi != null && metric.unit !== 'nodes' && (
                          <span className="block font-mono text-[11px] text-muted-foreground">
                            {fmt(c.lo, metric.unit).replace(/ \S+$/, '')}–{fmt(c.hi, metric.unit)}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="font-mono text-muted-foreground text-xs">{c?.why ? c.why.split(' ')[0] : '—'}</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  );
}
