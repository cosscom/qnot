import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Every size of the committed benchmark run (bench/results), for the comparison pages and the
// benchmark article. src/lib/bench.ts serves the landing page's 1,000-rule table; this one serves
// the series. Literal paths keep Next's file tracing scoped to the two result files.
const RESULTS = join(process.cwd(), '..', '..', 'bench', 'results', 'results.json');
const SIZES = join(process.cwd(), '..', '..', 'bench', 'results', 'sizes.json');

export const BENCH_SIZES = [10, 100, 500, 1000] as const;
export type BenchSize = (typeof BENCH_SIZES)[number];

export type LibId = 'qnot' | 'qnot-dom' | 'rqb' | 'raqb' | 'jqqb' | 'syncfusion' | 'devextreme';

export interface LibInfo {
  id: LibId;
  name: string;
  /** The package and version the harness ran. */
  pkg: string;
  version: string;
  license: string;
  /** Whether the bundle includes React (sizes are then reported without it). */
  react: boolean;
  us?: boolean;
}

export const LIBS: readonly LibInfo[] = [
  { id: 'qnot', name: 'qnot', pkg: '@qnot/react', version: '0.1', license: 'MIT', react: true, us: true },
  { id: 'qnot-dom', name: 'qnot, no framework', pkg: '@qnot/dom', version: '0.1', license: 'MIT', react: false, us: true },
  { id: 'rqb', name: 'react-querybuilder', pkg: 'react-querybuilder', version: '8.25', license: 'MIT', react: true },
  { id: 'raqb', name: 'react-awesome-query-builder', pkg: '@react-awesome-query-builder/ui', version: '6.6', license: 'MIT', react: true },
  { id: 'jqqb', name: 'jQuery QueryBuilder', pkg: 'jQuery-QueryBuilder', version: '3.0', license: 'MIT', react: false },
  { id: 'syncfusion', name: 'Syncfusion QueryBuilder', pkg: '@syncfusion/ej2-querybuilder', version: '35.1', license: 'Commercial or community', react: false },
  { id: 'devextreme', name: 'DevExtreme FilterBuilder', pkg: 'devextreme', version: '26.1', license: 'Commercial', react: false },
];

export const libInfo = (id: LibId): LibInfo => LIBS.find((l) => l.id === id)!;

interface RawRow {
  dom: number;
  mountColdMs: number;
  mountWarmMs: number;
  keystrokeMedianMs: number | null;
  keystrokeCpuMs: number | null;
  addRuleMedianMs: number | null;
  heapKB: number;
  sqlMs: number | null;
}

export interface BenchPoint {
  /** DOM nodes after mount. */
  dom: number;
  mount: number;
  mountWarm: number;
  keystroke: number | null;
  keystrokeCpu: number | null;
  add: number | null;
  /** Retained heap after mount, MB. */
  heap: number;
  sql: number | null;
}

export interface LibSize {
  /** Gzipped JS in KB, without React for React libraries (jQuery is included). */
  js: number;
  /** Gzipped CSS in KB (jQuery QueryBuilder's includes Bootstrap). */
  css: number;
}

export interface BenchData {
  date: string;
  series: Record<LibId, Record<BenchSize, BenchPoint>>;
  sizes: Record<LibId, LibSize>;
}

const kb = (bytes: number) => Math.round(bytes / 102.4) / 10;

let cache: BenchData | undefined;

/** The whole run: every library at 10, 100, 500 and 1,000 rules, plus bundle sizes. */
export function benchData(): BenchData {
  if (cache) return cache;
  const r = JSON.parse(readFileSync(RESULTS, 'utf8')) as { date: string; results: Record<string, Record<string, RawRow>> };
  const s = JSON.parse(readFileSync(SIZES, 'utf8')) as Record<string, { jsGz: number; cssGz: number }>;
  const react = s['_react-baseline']!.jsGz;
  const series = {} as BenchData['series'];
  const sizes = {} as BenchData['sizes'];
  for (const lib of LIBS) {
    const bySize = {} as Record<BenchSize, BenchPoint>;
    for (const n of BENCH_SIZES) {
      const row = r.results[lib.id]![String(n)]!;
      bySize[n] = {
        dom: row.dom,
        mount: Math.round(row.mountColdMs * 10) / 10,
        mountWarm: Math.round(row.mountWarmMs * 10) / 10,
        keystroke: row.keystrokeMedianMs,
        keystrokeCpu: row.keystrokeCpuMs,
        add: row.addRuleMedianMs,
        heap: Math.round(row.heapKB / 102.4) / 10,
        sql: row.sqlMs,
      };
    }
    series[lib.id] = bySize;
    sizes[lib.id] = { js: kb(s[lib.id]!.jsGz - (lib.react ? react : 0)), css: kb(s[lib.id]!.cssGz) };
  }
  cache = { date: r.date.slice(0, 10), series, sizes };
  return cache;
}

/** "1.2×", "48×": how many times `other` is of `ours` (lower is better for every metric). */
export function times(ours: number | null, other: number | null): string | null {
  if (ours === null || other === null || ours === 0) return null;
  const x = other / ours;
  return `${x >= 10 ? Math.round(x) : Math.round(x * 10) / 10}×`;
}
