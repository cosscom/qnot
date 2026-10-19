import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The committed results of bench/ (node build.mjs && node run.mjs), read at build time so the site
// always shows the latest run. Literal paths keep Next's file tracing scoped to these two files.
const RESULTS = join(process.cwd(), '..', '..', 'bench', 'results', 'results.json');
const SIZES = join(process.cwd(), '..', '..', 'bench', 'results', 'sizes.json');

interface Row {
  mountColdMs: number;
  keystrokeMedianMs: number | null;
  addRuleMedianMs: number | null;
  heapKB: number;
}
interface Results {
  date: string;
  results: Record<string, Record<string, Row>>;
}
type Sizes = Record<string, { jsGz: number }>;

const results = (): Results => JSON.parse(readFileSync(RESULTS, 'utf8')) as Results;
const sizes = (): Sizes => JSON.parse(readFileSync(SIZES, 'utf8')) as Sizes;

/** Libraries whose bundle includes React; their size is reported without it. */
const REACT_BASED = new Set(['qnot', 'rqb', 'raqb']);

export interface BenchRow {
  id: string;
  mount: number;
  keystroke: number | null;
  add: number | null;
  heap: number;
  js: number;
}

/** Medians at 1,000 rules, plus gzipped JS (excluding React for React libraries). */
export function benchAt1000(ids: readonly string[]): { date: string; rows: BenchRow[] } {
  const r = results();
  const s = sizes();
  const react = s['_react-baseline']!.jsGz;
  const rows = ids.map((id) => {
    const at = r.results[id]!['1000']!;
    const js = s[id]!.jsGz - (REACT_BASED.has(id) ? react : 0);
    return {
      id,
      mount: Math.round(at.mountColdMs),
      keystroke: at.keystrokeMedianMs,
      add: at.addRuleMedianMs,
      heap: Math.round(at.heapKB / 102.4) / 10,
      js: Math.round(js / 102.4) / 10,
    };
  });
  return { date: r.date.slice(0, 10), rows };
}
