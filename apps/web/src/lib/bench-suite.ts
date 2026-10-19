import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The full performance suite (bench/suite.mjs → bench/results/suite.json), read at build time for
// /benchmarks. The landing page and /compare keep reading results.json via bench.ts and
// bench-series.ts; suite.mjs refreshes that file from the same run. A literal path keeps Next's file
// tracing scoped to this one file.
const SUITE = join(process.cwd(), '..', '..', 'bench', 'results', 'suite.json');

export interface Stat {
  median: number;
  p25: number;
  p75: number;
  p95: number;
  min: number;
  max: number;
  n: number;
}

export interface UiPoint {
  rules?: number;
  dom?: number;
  mountCold?: Stat;
  mountWarm?: Stat | null;
  heapKB?: Stat;
  keystroke?: Stat;
  keystrokeCpu?: Stat;
  keystrokeCommitted?: boolean;
  changeField?: Stat;
  changeOperator?: Stat;
  reorder?: Stat;
  addRule?: Stat;
  addRuleCpu?: Stat;
  removeRule?: Stat;
  sqlMs?: number;
  notes?: Record<string, string>;
  errors?: Record<string, string>;
  skipped?: string;
  error?: string;
  /** A page that failed to mount and was replaced by a fresh one (once per size at most). */
  retried?: { page: number; error: string };
}

export interface CoreStat {
  usPerOp: { median: number; p25: number; p75: number; min: number; max: number };
  opsPerSec: number;
  spread: number;
  rounds: number;
  batch: number;
}

export interface SizeRow {
  js: number;
  jsGz: number;
  jsBr: number;
  css: number;
  cssGz: number;
  cssBr: number;
}

export interface Suite {
  schema: number;
  date: string;
  ui: { sizes: number[]; cpuThrottle: number; results: Record<string, Record<string, UiPoint>> };
  throttled: { sizes: number[]; cpuThrottle: number; results: Record<string, Record<string, UiPoint>> };
  core: { sizes: number[]; rounds: number; roundMs: number; rowsForMatches: number; results: Record<string, Record<string, CoreStat>> };
  bundle: { adapters: Record<string, SizeRow>; packages: Record<string, { min: number; gz: number; br: number }> };
  env: {
    cpu: string | null;
    cores: number;
    memoryGB: number;
    os: string;
    osName: string;
    machine: string | null;
    node: string;
    chromium: string;
    playwright: string | null;
    git: string | null;
    dirty: boolean;
    libraries: Record<string, string | null>;
    method: { viewport: string; uiSizes: number[]; repetitions: Record<string, { fast: Record<string, number | boolean>; slow: Record<string, number | boolean> }>; coreRounds: number | null; mountBudgetMs: number };
    durationMin: number;
  };
}

let cache: Suite | undefined;
export const suite = (): Suite => (cache ??= JSON.parse(readFileSync(SUITE, 'utf8')) as Suite);

export type AdapterId = 'qnot' | 'qnot-dom' | 'qnot-vue' | 'qnot-svelte' | 'qnot-solid' | 'rqb' | 'raqb' | 'jqqb' | 'syncfusion' | 'devextreme';

export interface AdapterInfo {
  id: AdapterId;
  /** Legend / table name. */
  name: string;
  /** Short axis label. */
  short: string;
  pkg: string;
  /** Library whose version env.libraries records (competitors), or null for qnot. */
  versionOf: string | null;
  us: boolean;
  /** Framework runtime bundled into the page and subtracted for "library only" sizes. */
  runtime: '_react-baseline' | '_vue' | '_svelte' | '_solid' | null;
  dashed?: boolean;
}

export const ADAPTERS: readonly AdapterInfo[] = [
  { id: 'qnot', name: 'qnot (React)', short: 'qnot React', pkg: '@qnot/react', versionOf: null, us: true, runtime: '_react-baseline' },
  { id: 'qnot-dom', name: 'qnot (no framework)', short: 'qnot DOM', pkg: '@qnot/dom', versionOf: null, us: true, runtime: null, dashed: true },
  { id: 'qnot-vue', name: 'qnot (Vue)', short: 'qnot Vue', pkg: '@qnot/vue', versionOf: null, us: true, runtime: '_vue' },
  { id: 'qnot-svelte', name: 'qnot (Svelte)', short: 'qnot Svelte', pkg: '@qnot/svelte', versionOf: null, us: true, runtime: '_svelte' },
  { id: 'qnot-solid', name: 'qnot (Solid)', short: 'qnot Solid', pkg: '@qnot/solid', versionOf: null, us: true, runtime: '_solid' },
  { id: 'rqb', name: 'react-querybuilder', short: 'RQB', pkg: 'react-querybuilder', versionOf: 'react-querybuilder', us: false, runtime: '_react-baseline' },
  { id: 'raqb', name: 'react-awesome-query-builder', short: 'RAQB', pkg: '@react-awesome-query-builder/ui', versionOf: '@react-awesome-query-builder/ui', us: false, runtime: '_react-baseline' },
  { id: 'jqqb', name: 'jQuery QueryBuilder', short: 'jQuery QB', pkg: 'jQuery-QueryBuilder', versionOf: 'jQuery-QueryBuilder', us: false, runtime: null },
  { id: 'syncfusion', name: 'Syncfusion QueryBuilder', short: 'Syncfusion', pkg: '@syncfusion/ej2-querybuilder', versionOf: '@syncfusion/ej2-querybuilder', us: false, runtime: null },
  { id: 'devextreme', name: 'DevExtreme FilterBuilder', short: 'DevExtreme', pkg: 'devextreme', versionOf: 'devextreme', us: false, runtime: null },
];

export const adapter = (id: AdapterId) => ADAPTERS.find((a) => a.id === id)!;
export const COMPETITORS = ADAPTERS.filter((a) => !a.us).map((a) => a.id);
export const BINDINGS = ADAPTERS.filter((a) => a.us).map((a) => a.id);

/** CSS colour of a series. */
export const colorOf = (id: AdapterId) => `var(--bench-${id})`;

export const versionOf = (a: AdapterInfo) => (a.versionOf ? (suite().env.libraries[a.versionOf] ?? '') : '');
