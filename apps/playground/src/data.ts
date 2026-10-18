import type { Fields as AnyFields, RowOf } from '@trawlnet/core';

const NAMES = ['Ada', 'Grace', 'Linus', 'Margaret', 'Alan', 'Barbara', 'Ken', 'Radia', 'Dennis', 'Frances', 'Edsger', 'Hedy'];
const WORDS = ['harbor', 'keel', 'mast', 'tide', 'reef', 'anchor', 'sail', 'buoy'];

// Deterministic PRNG so the sample data is stable between reloads.
function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Sample rows shaped by the schema, with a sprinkling of nulls. */
export function sampleRows<F extends AnyFields>(fields: F, count = 1000): RowOf<F>[] {
  const rand = rng(42);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
  return Array.from({ length: count }, (_, i) => {
    const row: Record<string, unknown> = {};
    for (const [name, def] of Object.entries(fields)) {
      if (rand() < 0.04) {
        row[name] = null;
        continue;
      }
      if (def.options) row[name] = pick(def.options).value;
      else if (def.kind === 'number') {
        const lo = def.min ?? 0;
        const hi = def.max ?? 100;
        row[name] = Math.round(lo + rand() * (hi - lo));
      } else if (def.kind === 'boolean') row[name] = rand() < 0.5;
      else if (def.kind === 'date') row[name] = new Date(Date.UTC(2018, 0, 1) + rand() * 8 * 365 * 864e5).toISOString().slice(0, 10);
      else if (name.toLowerCase().includes('email')) row[name] = `${pick(NAMES).toLowerCase()}.${i}@${pick(WORDS)}.dev`;
      else row[name] = `${pick(NAMES)} ${pick(WORDS)}`;
    }
    return row as RowOf<F>;
  });
}
