'use client';

// Axes for the /benchmarks charts. bklit's own axes label dates (its line chart is a time series),
// so these read the chart's scales from context and portal plain labels into the chart container,
// the way bklit's XAxis does.
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useChart } from '@/components/charts/chart-context';

function usePortalTarget() {
  const { containerRef } = useChart();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return mounted ? containerRef.current : null;
}

const label = 'pointer-events-none absolute whitespace-nowrap font-mono text-[11px] tabular-nums leading-none';

/** X labels at each data row; Y labels at the given (already transformed) tick values. */
export function LogAxes({ xLabels, yTicks }: { xLabels: string[]; yTicks: { value: number; label: string }[] }) {
  const { xScale, yScale, xAccessor, data, margin, innerHeight } = useChart();
  const target = usePortalTarget();
  if (!target) return null;
  return createPortal(
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {data.map((d, i) => (
        <span
          className={`${label} -translate-x-1/2 text-chart-label`}
          key={`x${i}`}
          style={{ left: margin.left + (xScale(xAccessor(d)) ?? 0), top: margin.top + innerHeight + 10 }}
        >
          {xLabels[i]}
        </span>
      ))}
      {yTicks.map((t) => (
        <span
          className={`${label} -translate-y-1/2 text-right text-chart-label`}
          key={`y${t.value}`}
          style={{ right: `calc(100% - ${margin.left - 8}px)`, top: margin.top + (yScale(t.value) ?? 0) }}
        >
          {t.label}
        </span>
      ))}
    </div>,
    target,
  );
}

/**
 * The value at the end of each bar of a horizontal bar chart (its value scale is the context's
 * yScale, its categories the band scale). `value(row)` is the plotted number, `text(row)` the label.
 */
export function BarEndLabels({ value, text }: { value: (row: Record<string, unknown>) => number; text: (row: Record<string, unknown>) => string }) {
  const { yScale, barScale, bandWidth, barXAccessor, data, margin } = useChart();
  const target = usePortalTarget();
  if (!target || !barScale || !barXAccessor) return null;
  return createPortal(
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {data.map((d, i) => (
        <span
          className={`${label} -translate-y-1/2 text-chart-foreground`}
          key={i}
          style={{ left: margin.left + (yScale(value(d)) ?? 0) + 8, top: margin.top + (barScale(barXAccessor(d)) ?? 0) + (bandWidth ?? 0) / 2 }}
        >
          {text(d)}
        </span>
      ))}
    </div>,
    target,
  );
}
