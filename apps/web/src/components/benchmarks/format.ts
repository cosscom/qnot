// Number formatting shared by the /benchmarks charts, tables and server copy.

export type Unit = 'ms' | 'us' | 'MB' | 'KB' | 'nodes' | 'ops' | 'x';

const trim = (s: string) => s.replace(/\.0+$|(\.\d*?)0+$/, '$1');

/** 0.42 ms, 8.4 ms, 120 ms, 6.6 s. */
export function fmtMs(v: number): string {
  if (v >= 1000) return `${trim((v / 1000).toFixed(v >= 10_000 ? 0 : 1))} s`;
  if (v >= 100) return `${Math.round(v)} ms`;
  if (v >= 10) return `${trim(v.toFixed(1))} ms`;
  return `${trim(v.toFixed(2))} ms`;
}

/** Microseconds: 0.05 µs, 12 µs, 1.2 ms. */
export function fmtUs(v: number): string {
  if (v >= 1000) return fmtMs(v / 1000);
  if (v >= 100) return `${Math.round(v)} µs`;
  if (v >= 10) return `${trim(v.toFixed(1))} µs`;
  return `${trim(v.toFixed(2))} µs`;
}

export const fmtInt = (v: number) => Math.round(v).toLocaleString('en-US');

/** 1,311 · 13k · 1.2M */
export function fmtCount(v: number): string {
  if (v >= 1e6) return `${trim((v / 1e6).toFixed(1))}M`;
  if (v >= 10_000) return `${Math.round(v / 1000)}k`;
  return fmtInt(v);
}

export function fmt(v: number | null | undefined, unit: Unit): string {
  if (v == null || !Number.isFinite(v)) return '—';
  switch (unit) {
    case 'ms':
      return fmtMs(v);
    case 'us':
      return fmtUs(v);
    case 'MB':
      return `${v >= 10 ? Math.round(v) : trim(v.toFixed(1))} MB`;
    case 'KB':
      return `${trim(v.toFixed(1))} KB`;
    case 'nodes':
      return fmtCount(v);
    case 'ops':
      return `${fmtCount(v)}/s`;
    case 'x':
      return `${v >= 10 ? Math.round(v) : trim(v.toFixed(1))}×`;
  }
}

/** Axis label for a decade tick (10^k) in a unit, kept short. */
export function fmtTick(v: number, unit: Unit): string {
  if (unit === 'ms') return v >= 1000 ? `${trim(String(v / 1000))} s` : v < 1 ? `${v} ms` : `${v} ms`;
  if (unit === 'us') return v >= 1000 ? fmtMs(v / 1000).replace('.0 ', ' ') : `${v} µs`;
  if (unit === 'nodes') return fmtCount(v);
  if (unit === 'MB') return `${v} MB`;
  if (unit === 'KB') return `${v} KB`;
  return String(v);
}

export const sizeLabel = (n: number) => `${n.toLocaleString('en-US')} rules`;

/** Axis label for a tree size: 10, 100, 500, 1k, 2.5k, 10k. */
export const fmtSize = (n: number) => (n >= 1000 ? `${trim((n / 1000).toFixed(1))}k` : String(n));
