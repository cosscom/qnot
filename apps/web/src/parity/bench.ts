import 'server-only';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ParityBench } from './ParityPage';

// Files outside apps/web, read at build time (the parity page is static). Literal paths keep
// Next's file tracing scoped to these files instead of the whole repo.
const DOC = join(process.cwd(), '..', '..', 'docs', 'raqb-parity.md');
const RESULTS = join(process.cwd(), '..', '..', 'bench', 'results', 'results.json');
const SIZES = join(process.cwd(), '..', '..', 'bench', 'results', 'sizes.json');

const readJson = <T,>(path: string): T | null => (existsSync(path) ? (JSON.parse(readFileSync(path, 'utf8')) as T) : null);

export const parityMarkdown = () => readFileSync(DOC, 'utf8');

type Sizes = Record<string, { jsGz: number }>;
type Results = { date: string; results: Record<string, Record<string, { keystrokeMedianMs: number; mountColdMs: number; heapKB: number }>> };

/** Head-to-head numbers from bench/ (see bench/README.md), from the committed results. */
export function parityBench(): ParityBench {
  const results = readJson<Results>(RESULTS);
  const sizes = readJson<Sizes>(SIZES);
  if (!results) throw new Error('bench/results/results.json is missing');
  const at = (lib: string) => results.results[lib]!['1000']!;
  const kb = (bytes: number) => Math.round(bytes / 102.4) / 10;
  const react = sizes?.['_react-baseline']?.jsGz;
  // Last measured bundle sizes (gzip, excl. React), used when bench/dist isn't built locally.
  if (!sizes || !react) throw new Error('bench/results/sizes.json is missing');
  const bundleKb = { trawlnet: kb(sizes.trawlnet!.jsGz - react), raqb: kb(sizes.raqb!.jsGz - react) };
  return {
    bundleKb,
    keystrokeMs: { trawlnet: at('trawlnet').keystrokeMedianMs, raqb: at('raqb').keystrokeMedianMs },
    mountMs: { trawlnet: Math.round(at('trawlnet').mountColdMs), raqb: Math.round(at('raqb').mountColdMs) },
    heapMb: { trawlnet: Math.round(at('trawlnet').heapKB / 102.4) / 10, raqb: Math.round(at('raqb').heapKB / 102.4) / 10 },
    source: `bench/ run of ${results.date.slice(0, 10)}, headless Chromium, 1000 rules`,
  };
}
