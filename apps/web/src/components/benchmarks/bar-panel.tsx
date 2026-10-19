'use client';

// Horizontal bar charts (bklit BarChart) with a group switcher, value labels at the bar ends, a
// tooltip with the spread, and a table view. qnot's bars and everyone else's are two stacked series
// (one of them zero per row) so they can take different colours.
import { useState } from 'react';
import { Bar } from '@/components/charts/bar';
import { BarChart } from '@/components/charts/bar-chart';
import { BarYAxis } from '@/components/charts/bar-y-axis';
import { ChartTooltip } from '@/components/charts/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTab } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { BarEndLabels } from './chart-axes';
import { fmt, type Unit } from './format';

export interface BarRow {
  /** Axis label (short). */
  name: string;
  /** Tooltip / table label (full). */
  label?: string;
  value: number;
  us?: boolean;
  /** Label at the bar's end, when it should say more than the value. */
  end?: string;
  /** Extra lines for the tooltip and table (spread, brotli, …). */
  detail?: string[];
}

export interface BarGroup {
  id: string;
  label: string;
  unit: Unit;
  rows: BarRow[];
  note?: string;
}

const US = 'var(--bench-us)';
const THEM = 'var(--bench-them)';

export function BarPanel({ caption, groups, labelWidth = 132 }: { caption: string; groups: BarGroup[]; labelWidth?: number }) {
  const [groupId, setGroupId] = useState(groups[0]!.id);
  const [view, setView] = useState<'chart' | 'table'>('chart');
  const group = groups.find((g) => g.id === groupId) ?? groups[0]!;
  const data = group.rows.map((r) => ({ name: r.name, us: r.us ? r.value : 0, them: r.us ? 0 : r.value, row: r }));
  const valueOf = (d: Record<string, unknown>) => (d.row as BarRow).value;

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3 border-b px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        {groups.length > 1 ? (
          <Tabs onValueChange={(v) => setGroupId(String(v))} value={groupId}>
            <ScrollArea className="max-w-full" clampContentMinWidth={false} scrollFade>
              <TabsList>
                {groups.map((g) => (
                  <TabsTab key={g.id} value={g.id}>
                    {g.label}
                  </TabsTab>
                ))}
              </TabsList>
            </ScrollArea>
          </Tabs>
        ) : (
          <p className="font-medium">{group.label}</p>
        )}
        <Tabs onValueChange={(v) => setView(v as 'chart' | 'table')} value={view}>
          <TabsList aria-label="View">
            <TabsTab value="chart">Chart</TabsTab>
            <TabsTab value="table">Table</TabsTab>
          </TabsList>
        </Tabs>
      </div>
      {view === 'chart' ? (
        <figure aria-label={`${caption}: ${group.label}`} className="px-2 pt-4 pb-3 sm:px-6">
          <div style={{ height: data.length * 34 + 8 }}>
          <BarChart
            animationDuration={600}
            aspectRatio=""
            barGap={0.28}
            className="h-full"
            data={data}
            margin={{ top: 4, right: 96, bottom: 4, left: labelWidth }}
            orientation="horizontal"
            revealSignature={group.id}
            stacked
          >
            <Bar dataKey="them" fill={THEM} lineCap={3} />
            <Bar dataKey="us" fill={US} lineCap={3} />
            <BarYAxis />
            <BarEndLabels text={(d) => (d.row as BarRow).end ?? fmt(valueOf(d), group.unit)} value={valueOf} />
            <ChartTooltip content={({ point }) => <BarTip row={point.row as BarRow} unit={group.unit} />} showCrosshair={false} showDatePill={false} showDots={false} />
          </BarChart>
          </div>
          {group.note && <figcaption className="px-2 pt-2 font-mono text-muted-foreground text-xs">{group.note}</figcaption>}
        </figure>
      ) : (
        <ScrollArea clampContentMinWidth={false} scrollFade>
          <table className="w-full min-w-[30rem] border-collapse text-sm">
            <caption className="px-4 pt-4 text-left font-mono text-muted-foreground text-xs sm:px-8">
              {caption}: {group.label}
            </caption>
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left font-mono font-normal text-muted-foreground text-xs sm:px-8" scope="col">
                  name
                </th>
                <th className="px-4 py-3 text-right font-mono font-normal text-muted-foreground text-xs" scope="col">
                  value
                </th>
                <th className="px-4 py-3 text-left font-mono font-normal text-muted-foreground text-xs sm:px-8" scope="col">
                  detail
                </th>
              </tr>
            </thead>
            <tbody>
              {group.rows.map((r) => (
                <tr className={cn('border-b last:border-b-0', r.us && 'bg-muted/30')} key={r.name}>
                  <th className={cn('px-4 py-3 text-left font-normal sm:px-8', r.us ? 'font-medium' : 'text-foreground/80')} scope="row">
                    {r.label ?? r.name}
                  </th>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{fmt(r.value, group.unit)}</td>
                  <td className="px-4 py-3 font-mono text-muted-foreground text-xs sm:px-8">{r.detail?.join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </ScrollArea>
      )}
    </div>
  );
}

function BarTip({ row, unit }: { row: BarRow; unit: Unit }) {
  return (
    <div className="flex min-w-44 flex-col gap-1 px-3 py-2.5">
      <p className="font-medium text-chart-tooltip-foreground text-sm">{row.label ?? row.name}</p>
      <p className="font-mono text-chart-tooltip-foreground text-xs tabular-nums">{fmt(row.value, unit)}</p>
      {row.detail?.map((d) => (
        <p className="font-mono text-chart-tooltip-muted text-xs" key={d}>
          {d}
        </p>
      ))}
    </div>
  );
}
