import type { Metadata } from 'next';
import Link from 'next/link';
import { BarPanel, type BarGroup, type BarRow } from '@/components/benchmarks/bar-panel';
import { fmt, fmtCount, fmtInt, sizeLabel, type Unit } from '@/components/benchmarks/format';
import { ScalingChart, type Cell, type ChartSeries, type ScalingMetric } from '@/components/benchmarks/scaling-chart';
import { EndLinks, PageHero, Prose, Section, Sheet } from '@/components/seo/blocks';
import { CopyLine } from '@/components/site/copy-line';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ADAPTERS, adapter, BINDINGS, COMPETITORS, colorOf, suite, versionOf, type AdapterId, type Stat, type UiPoint } from '@/lib/bench-suite';
import { pageMetadata } from '@/lib/seo';
import { GITHUB_URL } from '@/lib/site';
import { cn } from '@/lib/utils';

export const metadata: Metadata = pageMetadata({
  title: 'Query builder benchmarks: render, typing, memory and bundle size',
  description:
    'qnot and five other JavaScript query builders measured from 10 to 5,000 rules: first render, keystroke, field and operator changes, drag, add and remove, memory, DOM size, 4× CPU throttling, codec throughput and bundle size.',
  path: '/benchmarks',
});

// --- data shaping (server only) ------------------------------------------------------------------

type UiKey = 'mountCold' | 'keystroke' | 'changeField' | 'changeOperator' | 'reorder' | 'addRule' | 'removeRule' | 'heapKB' | 'dom' | 'keystrokeCpu';

/** Which `notes` entry explains a missing metric. */
const NOTE_KEY: Partial<Record<UiKey, string>> = { keystroke: 'type', keystrokeCpu: 'type', changeField: 'changeField', changeOperator: 'changeOperator', reorder: 'reorder', removeRule: 'removeRule' };
const ERROR_KEY: Partial<Record<UiKey, string>> = { keystroke: 'keystroke', keystrokeCpu: 'keystroke', addRule: 'addRule' };

/** Notes from the last measured size carry the library-level reasons (no inline typing, no drag and drop). */
function libNotes(results: Record<string, UiPoint>): Record<string, string> {
  return Object.values(results).find((p) => p.notes)?.notes ?? {};
}

function cell(p: UiPoint | undefined, key: UiKey, notes: Record<string, string>, scale = 1): Cell {
  if (!p) return { v: null, why: 'not run' };
  if (p.skipped) return { v: null, why: `skipped (${p.skipped})` };
  if (p.error) return { v: null, why: `failed (${p.error})` };
  if (key === 'dom') return p.dom != null ? { v: p.dom } : { v: null, why: 'not measured' };
  const s = p[key] as Stat | undefined;
  if (s) return { v: s.median / scale, lo: s.p25 / scale, hi: s.p75 / scale };
  const nk = NOTE_KEY[key];
  if (nk && notes[nk]) return { v: null, why: `n/a: ${notes[nk]}` };
  const ek = p.errors?.[ERROR_KEY[key] ?? key];
  if (ek) return { v: null, why: `failed (${ek})` };
  return { v: null, why: 'n/a' };
}

function uiMetric(ids: readonly AdapterId[], key: UiKey, label: string, unit: Unit, note: string, results = suite().ui.results, sizes = suite().ui.sizes): ScalingMetric {
  const scale = key === 'heapKB' ? 1024 : 1;
  return {
    id: key,
    label,
    unit,
    note,
    cells: Object.fromEntries(ids.map((id) => [id, sizes.map((n) => cell(results[id]?.[n], key, libNotes(results[id] ?? {}), scale))])),
  };
}

const seriesOf = (ids: readonly AdapterId[]): ChartSeries[] => ids.map((id) => ({ id, label: adapter(id).name, color: colorOf(id), dashed: adapter(id).dashed, us: adapter(id).us }));

const at = (id: AdapterId, n: number) => suite().ui.results[id]?.[n];
const med = (id: AdapterId, n: number, key: UiKey): number | null => {
  const p = at(id, n);
  if (!p || p.skipped || p.error) return null;
  if (key === 'dom') return p.dom ?? null;
  const s = p[key] as Stat | undefined;
  return s ? (key === 'heapKB' ? s.median / 1024 : s.median) : null;
};

const kb = (bytes: number) => Math.round(bytes / 102.4) / 10;
/** "First render" → "first render", "JS heap" stays. */
const lower = (label: string) => label.replace(/^[A-Z](?=[a-z])/, (c) => c.toLowerCase());

// --- page ----------------------------------------------------------------------------------------

const HEADLINE: { key: UiKey; label: string; unit: Unit }[] = [
  { key: 'mountCold', label: 'First render', unit: 'ms' },
  { key: 'keystroke', label: 'Keystroke', unit: 'ms' },
  { key: 'changeField', label: 'Change field', unit: 'ms' },
  { key: 'addRule', label: 'Add a rule', unit: 'ms' },
  { key: 'removeRule', label: 'Remove a rule', unit: 'ms' },
  { key: 'reorder', label: 'Drag to reorder', unit: 'ms' },
  { key: 'heapKB', label: 'JS heap', unit: 'MB' },
  { key: 'dom', label: 'DOM nodes', unit: 'nodes' },
];

const TABLE_IDS: AdapterId[] = ['qnot', 'qnot-dom', 'qnot-vue', 'qnot-svelte', 'qnot-solid', ...COMPETITORS];

export default function Page() {
  const s = suite();
  const env = s.env;
  const date = s.date.slice(0, 10);
  const N = 1000;
  const sizes = s.ui.sizes;
  const vsIds: AdapterId[] = ['qnot', 'qnot-dom', ...COMPETITORS];

  // Headline tiles: qnot (React) against the best and the median competitor at 1,000 rules.
  const tiles = (['mountCold', 'keystroke', 'addRule', 'heapKB'] as UiKey[]).map((key) => {
    const h = HEADLINE.find((x) => x.key === key)!;
    const ours = med('qnot', N, key);
    const theirs = COMPETITORS.map((id) => ({ id, v: med(id, N, key) })).filter((x): x is { id: AdapterId; v: number } => x.v != null).sort((a, b) => a.v - b.v);
    return { ...h, ours, dom: med('qnot-dom', N, key), best: theirs[0], worst: theirs[theirs.length - 1] };
  });
  const jsOf = (id: AdapterId) => {
    const a = adapter(id);
    const row = s.bundle.adapters[id]!;
    return kb(row.jsGz - (a.runtime === '_react-baseline' ? s.bundle.adapters['_react-baseline']!.jsGz : 0));
  };
  const jsTheirs = COMPETITORS.map((id) => ({ id, v: jsOf(id) })).sort((a, b) => a.v - b.v);

  const vsMetrics: ScalingMetric[] = [
    uiMetric(vsIds, 'mountCold', 'First render', 'ms', 'cold mount of the stored tree in a fresh page, median'),
    uiMetric(vsIds, 'keystroke', 'Keystroke', 'ms', 'one character into a mid-tree text value until the DOM shows it, median'),
    uiMetric(vsIds, 'changeField', 'Change field', 'ms', 'switch a rule between a text and a number field through its picker, median'),
    uiMetric(vsIds, 'addRule', 'Add rule', 'ms', 'click "add rule" on the root group until the row appears, median'),
    uiMetric(vsIds, 'removeRule', 'Remove rule', 'ms', 'click a rule’s remove control until the row is gone, median'),
    uiMetric(vsIds, 'heapKB', 'JS heap', 'MB', 'retained JS heap after mount, after forced GC (DOM memory not included)'),
    uiMetric(vsIds, 'dom', 'DOM nodes', 'nodes', 'elements under the builder’s root after mount'),
  ];
  const bindingMetrics: ScalingMetric[] = [
    uiMetric(BINDINGS, 'mountCold', 'First render', 'ms', 'cold mount, median'),
    uiMetric(BINDINGS, 'keystroke', 'Keystroke', 'ms', 'one character into a text value, median'),
    uiMetric(BINDINGS, 'addRule', 'Add rule', 'ms', 'add a rule to the root group, median'),
    uiMetric(BINDINGS, 'reorder', 'Drag to reorder', 'ms', 'HTML5 drop of a rule at the top of its group, median'),
    uiMetric(BINDINGS, 'heapKB', 'JS heap', 'MB', 'retained JS heap after mount'),
  ];

  // Throttled: 4× vs 1× for the headline metrics.
  const thr = s.throttled;
  const throttledGroups: BarGroup[] = thr.sizes
    .slice()
    .reverse()
    .flatMap((n) =>
      (
        [
          ['mountCold', 'First render'],
          ['keystroke', 'Keystroke'],
          ['addRule', 'Add rule'],
        ] as const
      ).map(([key, label]) => ({
        id: `${key}-${n}`,
        label: `${label}, ${fmtCount(n)}`,
        unit: 'ms' as Unit,
        note: `${thr.cpuThrottle}× CPU slowdown (Chrome DevTools throttling), ${sizeLabel(n)}, median. After the dot: how many times slower than unthrottled.`,
        rows: vsIds.flatMap((id): BarRow[] => {
          const p = thr.results[id]?.[n];
          const st = p?.[key] as Stat | undefined;
          if (!st) return [];
          const base = med(id, n, key);
          return [
            {
              name: adapter(id).short,
              label: adapter(id).name,
              value: st.median,
              us: adapter(id).us,
              end: base ? `${fmt(st.median, 'ms')} · ${fmt(st.median / base, 'x')}` : undefined,
              detail: [`1×: ${fmt(base, 'ms')}`, ...(base ? [`slowdown ${fmt(st.median / base, 'x')}`] : []), `p25–p75 ${fmt(st.p25, 'ms')}–${fmt(st.p75, 'ms')}`],
            },
          ];
        }),
      })),
    )
    .filter((g) => g.rows.length > 0);
  const thrSkipped = vsIds.flatMap((id) => thr.sizes.flatMap((n) => (thr.results[id]?.[n]?.skipped ? [`${adapter(id).name} at ${fmtCount(n)}`] : [])));
  const thrNoType = vsIds.filter((id) => thr.sizes.every((n) => !thr.results[id]?.[n]?.keystroke)).map((id) => adapter(id).name);

  // Core.
  const core = s.core;
  const CORE_OPS: { key: string; label: string; color: string }[] = [
    { key: 'store: load', label: 'Load into store', color: 'var(--bench-qnot)' },
    { key: 'compile', label: 'Compile to predicate', color: 'var(--bench-rqb)' },
    { key: 'validate', label: 'Validate', color: 'var(--bench-raqb)' },
    { key: 'encode sql (ansi)', label: 'Encode SQL', color: 'var(--bench-jqqb)' },
    { key: 'decode sql (parse)', label: 'Parse SQL', color: 'var(--bench-syncfusion)' },
    { key: 'sql after one edit', label: 'Edit + re-encode SQL', color: 'var(--bench-qnot-svelte)' },
    { key: 'matches (compiled, per row)', label: 'Match one row', color: 'var(--bench-devextreme)' },
    { key: 'store: edit value', label: 'Edit a value', color: 'var(--bench-qnot-vue)' },
  ];
  const coreScaling: ScalingMetric = {
    id: 'core',
    label: 'Time per operation',
    unit: 'us',
    note: 'µs per call, median of rounds',
    range: 'min–max of rounds',
    // Series ids are plain (op0, op1, …): bklit builds element ids from data keys.
    cells: Object.fromEntries(
      CORE_OPS.map((o, i) => [`op${i}`, core.sizes.map((n) => {
        const st = core.results[o.key]?.[n];
        return st ? { v: st.usPerOp.median, lo: st.usPerOp.min, hi: st.usPerOp.max } : { v: null, why: 'not run' };
      })]),
    ),
  };
  const codecKeys = Object.keys(core.results).filter((k) => k.startsWith('encode ') || k.startsWith('decode '));
  const codecGroups: BarGroup[] = core.sizes
    .filter((n) => n >= 100)
    .map((n) => ({
      id: `codec-${n}`,
      label: sizeLabel(n),
      unit: 'us' as Unit,
      note: `One call on a fresh ${n.toLocaleString('en-US')}-rule query (nothing memoized), median of ${core.rounds} rounds. Grey: encoders; teal: parsing SQL back into a query.`,
      rows: codecKeys
        .map((k) => {
          const st = core.results[k]![n]!;
          return {
            name: k.replace(/^encode /, '').replace(/^decode sql \(parse\)$/, 'parse sql').replace(/ \(postgres, \$n params\)/, ' pg $n'),
            label: k,
            value: st.usPerOp.median,
            us: k.startsWith('decode'),
            detail: [`${fmtCount(st.opsPerSec)} ops/s`, `rounds ${fmt(st.usPerOp.min, 'us')}–${fmt(st.usPerOp.max, 'us')}`, `IQR ±${Math.round(st.spread * 50)}%`],
          };
        })
        .sort((a, b) => a.value - b.value),
    }));
  const memo1k = core.results['sql after one edit']?.['10000'];
  const cold1k = core.results['encode sql (ansi)']?.['10000'];

  // Bundle.
  const react = s.bundle.adapters['_react-baseline']!;
  const bundleRow = (id: AdapterId, pick: (r: typeof react) => number, sub = 0): BarRow => {
    const r = s.bundle.adapters[id]!;
    return {
      name: adapter(id).short,
      label: `${adapter(id).name} (${adapter(id).pkg})`,
      value: kb(pick(r) - sub),
      us: adapter(id).us,
      detail: [`gzip ${kb(r.jsGz)} KB`, `brotli ${kb(r.jsBr)} KB`, `min ${kb(r.js)} KB`, `CSS gzip ${kb(r.cssGz)} KB`],
    };
  };
  const bundleGroups: BarGroup[] = [
    {
      id: 'lib',
      label: 'Library JS',
      unit: 'KB',
      note: 'Minified + gzip of the benchmark page, minus the framework runtime (React, Vue, Svelte, Solid; jQuery stays in). Includes each library’s SQL export.',
      rows: TABLE_IDS.map((id) => {
        const rt = adapter(id).runtime;
        return bundleRow(id, (r) => r.jsGz, rt ? s.bundle.adapters[rt]!.jsGz : 0);
      }).sort((a, b) => a.value - b.value),
    },
    {
      id: 'page',
      label: 'Whole page JS',
      unit: 'KB',
      note: 'Everything the page loads, framework included, minified + gzip.',
      rows: TABLE_IDS.map((id) => bundleRow(id, (r) => r.jsGz)).sort((a, b) => a.value - b.value),
    },
    {
      id: 'brotli',
      label: 'Library JS, brotli',
      unit: 'KB',
      note: 'As "Library JS" with brotli (quality 11) instead of gzip.',
      rows: TABLE_IDS.map((id) => {
        const rt = adapter(id).runtime;
        return bundleRow(id, (r) => r.jsBr, rt ? s.bundle.adapters[rt]!.jsBr : 0);
      }).sort((a, b) => a.value - b.value),
    },
    {
      id: 'css',
      label: 'CSS',
      unit: 'KB',
      note: 'Each library’s default stylesheet, minified + gzip (jQuery QueryBuilder’s includes Bootstrap).',
      rows: TABLE_IDS.map((id) => bundleRow(id, (r) => r.cssGz)).sort((a, b) => a.value - b.value),
    },
    {
      id: 'packages',
      label: 'qnot packages',
      unit: 'KB',
      note: 'Every export of each entry point (export *), minified + gzip, framework external. Tree-shaking only goes down from here.',
      rows: Object.entries(s.bundle.packages)
        .map(([name, v]) => ({ name: name.replace('@qnot/core/formats/', 'formats/').replace('@qnot/', ''), label: name, value: kb(v.gz), us: true, detail: [`brotli ${kb(v.br)} KB`, `min ${kb(v.min)} KB`] }))
        .sort((a, b) => a.value - b.value),
    },
  ];

  // Where others win, and what is noisy: computed from the run, not written by hand.
  const wins: string[] = [];
  for (const h of HEADLINE) {
    for (const ours of ['qnot', 'qnot-dom'] as AdapterId[]) {
      const o = med(ours, N, h.key);
      if (o == null) continue;
      const beat = COMPETITORS.map((id) => ({ id, v: med(id, N, h.key) })).filter((x) => x.v != null && x.v < o * 0.95);
      for (const b of beat) wins.push(`${adapter(b.id).name} beats ${adapter(ours).name} on ${lower(h.label)} at 1,000 rules: ${fmt(b.v, h.unit)} vs ${fmt(o, h.unit)}.`);
    }
  }
  const noisyAll: { text: string; rel: number }[] = [];
  let measured = 0;
  for (const id of TABLE_IDS) {
    for (const h of HEADLINE) {
      if (h.key === 'dom') continue;
      for (const n of sizes.filter((x) => x >= 100)) {
        const st = at(id, n)?.[h.key] as Stat | undefined;
        if (!st) continue;
        measured++;
        const rel = (st.p75 - st.p25) / st.median;
        if (st.median >= 0.5 && rel > 0.5) noisyAll.push({ rel, text: `${adapter(id).name}, ${lower(h.label)} at ${fmtCount(n)}: ${fmt(st.median, h.unit)} with p25–p75 ${fmt(st.p25, h.unit)}–${fmt(st.p75, h.unit)}` });
      }
    }
  }
  const noisy = noisyAll.sort((a, b) => b.rel - a.rel);
  // Bindings that trail qnot's React binding by 1.5× or more at 1,000 rules.
  const weaker: string[] = [];
  for (const id of BINDINGS.filter((b) => b !== 'qnot')) {
    for (const h of HEADLINE) {
      const r = med('qnot', N, h.key);
      const v = med(id, N, h.key);
      if (r != null && v != null && v >= r * 1.5 && v - r > (h.unit === 'ms' ? 1 : 0)) weaker.push(`${adapter(id).name}: ${lower(h.label)} ${fmt(v, h.unit)} vs ${fmt(r, h.unit)} with React at 1,000 rules.`);
    }
  }
  const retried = TABLE_IDS.flatMap((id) => sizes.flatMap((n) => (at(id, n)?.retried ? [`${adapter(id).name} at ${fmtCount(n)}`] : [])));
  const skippedAll = TABLE_IDS.flatMap((id) => sizes.flatMap((n) => (at(id, n)?.skipped ? [`${adapter(id).name} at ${fmtCount(n)}`] : [])));

  const rep = env.method.repetitions;
  const machine = [env.machine, env.cpu, `${env.cores} cores`, `${env.memoryGB} GB`].filter(Boolean).join(', ');

  return (
    <Sheet path="/benchmarks">
      <PageHero
        aside={
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 font-mono text-xs">
            <div>
              <dt className="text-muted-foreground">run</dt>
              <dd className="mt-0.5 text-foreground">{date}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">machine</dt>
              <dd className="mt-0.5 text-foreground">{env.cpu ?? env.machine}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">browser</dt>
              <dd className="mt-0.5 text-foreground">Chromium {env.chromium}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">suite</dt>
              <dd className="mt-0.5 text-foreground">{env.durationMin} min wall clock</dd>
            </div>
          </dl>
        }
        lede="Six JavaScript query builders, the same tree from 10 to 5,000 rules, every interaction through each library's own UI. Medians with their spread, a 4× slower CPU, the core engine on its own, and bundle sizes."
        tags={['measured', 'reproducible', 'medians + spread']}
        title="Benchmarks"
      />

      <Section id="headline-title" intro={<>Production builds, headless Chromium, no throttling. Each tile is qnot with React against the fastest and slowest of the five other libraries; the table has every library and interaction.</>} title="At 1,000 rules.">
        <div className="overflow-hidden">
          <dl className="-me-px -mb-px grid grid-cols-2 xl:grid-cols-5">
            {tiles.map((t) => (
              <div className="flex flex-col gap-2 border-r border-b px-4 py-6 sm:px-8" key={t.key}>
                <dt className="font-mono text-muted-foreground text-xs">{t.label.toLowerCase()}</dt>
                <dd className="flex flex-col gap-2">
                  <span className="font-semibold text-3xl tabular-nums tracking-[-0.03em] sm:text-4xl">{fmt(t.ours, t.unit)}</span>
                  <span className="text-muted-foreground text-xs leading-snug sm:text-sm">
                    no framework {fmt(t.dom, t.unit)}
                    <br />
                    best other: {t.best ? `${fmt(t.best.v, t.unit)} (${adapter(t.best.id).short})` : '—'}
                    <br />
                    slowest: {t.worst ? `${fmt(t.worst.v, t.unit)} (${adapter(t.worst.id).short})` : '—'}
                  </span>
                </dd>
              </div>
            ))}
            <div className="flex flex-col gap-2 border-r border-b px-4 py-6 sm:px-8">
              <dt className="font-mono text-muted-foreground text-xs">library js, gzip, with sql export</dt>
              <dd className="flex flex-col gap-2">
                <span className="font-semibold text-3xl tabular-nums tracking-[-0.03em] sm:text-4xl">{jsOf('qnot')} KB</span>
                <span className="text-muted-foreground text-xs leading-snug sm:text-sm">
                  no framework {jsOf('qnot-dom')} KB
                  <br />
                  best other: {jsTheirs[0]!.v} KB ({adapter(jsTheirs[0]!.id).short})
                  <br />
                  largest: {jsTheirs[jsTheirs.length - 1]!.v} KB ({adapter(jsTheirs[jsTheirs.length - 1]!.id).short})
                </span>
              </dd>
            </div>
          </dl>
        </div>
        <HeadlineTable n={N} />
      </Section>

      <Section
        id="scaling-title"
        intro={<>Every size from 10 to {fmtInt(sizes[sizes.length - 1]!)} rules on log–log axes, so a straight line is a power law and parallel lines are a constant factor apart. Click a library in the legend to hide it; switch to the table for exact numbers and spreads.</>}
        title="How each library scales."
      >
        <ScalingChart caption="Scaling by tree size" metrics={vsMetrics} series={seriesOf(vsIds)} sizes={sizes} />
      </Section>

      <Section
        id="bindings-title"
        intro={<>The same core under each binding. The renderer is the only difference: same store, same stored query, same markup and classes.</>}
        title="qnot in every framework."
      >
        <ScalingChart caption="qnot bindings by tree size" metrics={bindingMetrics} series={seriesOf(BINDINGS)} sizes={sizes} />
      </Section>

      <Section
        id="throttle-title"
        intro={
          <>
            Chrome's CPU throttling at {thr.cpuThrottle}× approximates a mid-range phone. Fewer repetitions than the main run (fresh pages: 5 at 100 rules, 3 at 1,000), so read the spreads in the table.
          </>
        }
        title={`On a ${thr.cpuThrottle}× slower CPU.`}
      >
        <BarPanel caption={`${thr.cpuThrottle}× CPU throttle`} groups={throttledGroups} labelWidth={120} />
        {(thrSkipped.length > 0 || thrNoType.length > 0) && (
          <p className="border-t px-4 py-4 font-mono text-muted-foreground text-xs sm:px-8">
            {thrSkipped.length > 0 && <>Not run (projected over the time budget): {thrSkipped.join(', ')}. </>}
            {thrNoType.length > 0 && <>No keystroke number for {thrNoType.join(', ')}: no inline value input.</>}
          </p>
        )}
      </Section>

      <Section
        id="core-title"
        intro={
          <>
            <code>@qnot/core</code> alone in Node {env.node}, no DOM: the store, validation, evaluation and every codec, on queries of {core.sizes.map(fmtCount).join(', ')} rules with mixed operators. Each number is
            the median of {core.rounds} timed rounds of ~{core.roundMs} ms after a warm-up round.
          </>
        }
        title="The engine on its own."
      >
        <ScalingChart
          caption="Core operations by query size"
          height="h-80 sm:h-[26rem]"
          metrics={[coreScaling]}
          series={CORE_OPS.map((o, i) => ({ id: `op${i}`, label: o.label, color: o.color }))}
          sizes={core.sizes}
        />
        {memo1k && cold1k && (
          <p className="border-t px-4 py-5 text-muted-foreground leading-relaxed sm:px-8">
            Encoding is memoized per node and an edit only replaces the path to the changed rule, so re-encoding SQL after one edit to a 10,000-rule query takes{' '}
            <span className="text-foreground">{fmt(memo1k.usPerOp.median, 'us')}</span> against <span className="text-foreground">{fmt(cold1k.usPerOp.median, 'us')}</span> for a cold encode.
          </p>
        )}
        <div className="border-t">
          <BarPanel caption="Codec throughput" groups={codecGroups} labelWidth={150} />
        </div>
      </Section>

      <Section id="bundle-title" intro={<>Built with esbuild 0.28 for the benchmark pages; lower is better. Hover a bar for gzip, brotli and minified sizes.</>} title="What you ship.">
        <BarPanel caption="Bundle size" groups={bundleGroups} labelWidth={124} />
      </Section>

      <Section id="method-title" intro="What each number is, how it was taken, and how to get your own." title="Methodology.">
        <div className="grid gap-10 px-4 py-8 sm:px-8 lg:grid-cols-12">
          <div className="lg:col-span-7">
            <Prose>
              <h3>The tree</h3>
              <p>
                Ten fields (text, number, select, boolean) and a root AND group of OR groups with ten rules each, so 1,000 rules is 100 groups. Every library gets the same tree, converted to its own stored
                format outside the timed region, with its default widgets and its recommended stylesheet.
              </p>
              <h3>The metrics</h3>
              <ul>
                <li>
                  <strong>First render</strong>: <code>performance.now()</code> around "load the stored JSON and render" until every rule row is in the DOM, then a forced layout. Cold, in a fresh page
                  each time: {rep['1000']?.fast.pages} pages per size up to 1,000 rules and {rep['5000']?.fast.pages} above (fewer for libraries whose mount takes seconds).
                </li>
                <li>
                  <strong>Keystroke</strong>: set a mid-tree text value, dispatch <code>input</code> and <code>change</code>, wait one macrotask and force layout. {rep['1000']?.fast.keys} keystrokes per size;
                  afterwards the library's own SQL export must contain the typed text, so the model was updated, not just the input.
                </li>
                <li>
                  <strong>Change field / operator</strong>: open the rule's field or operator picker the way a user does (focus and press on native selects, which also fills qnot's lazy option lists; a click
                  on popup menus) and pick another option. Field changes alternate Age and First name so the value editor changes too.
                </li>
                <li>
                  <strong>Drag to reorder</strong>: drag a rule to the top of its group with the library's own drag and drop, timed from the drop. Only qnot and react-awesome-query-builder have drag and drop
                  in their default setup.
                </li>
                <li>
                  <strong>Add / remove rule</strong>: the library's own buttons on the root group and on a rule. Menu-based libraries (Syncfusion, DevExtreme) include opening the menu.
                </li>
                <li>
                  <strong>JS heap</strong>: <code>Runtime.getHeapUsage</code> after a forced GC, before and after the first mount. It does not count DOM memory, which is why a library that keeps its state
                  in the DOM looks light here; read it with the DOM node count.
                </li>
                <li>
                  <strong>DOM nodes</strong>: elements under the builder's root after mount.
                </li>
                <li>
                  <strong>Interactions</strong> run {rep['1000']?.fast.actions} times on the last page of each size; every metric records median, p25, p75, p95, min, max and the sample count.
                </li>
                <li>
                  <strong>Core</strong>: batches calibrated to ~{core.roundMs} ms, inputs prepared outside the timed loop (encode results are memoized per node, so a "cold" encode needs a fresh query
                  each call); µs per call, median of {core.rounds} rounds, with min and max.
                </li>
                <li>
                  <strong>Budget</strong>: a size is skipped and recorded as skipped when the smaller sizes project a cold mount over {Math.round(env.method.mountBudgetMs / 1000)} s.
                </li>
              </ul>
            </Prose>
          </div>
          <div className="flex flex-col gap-6 lg:col-span-5">
            <div>
              <h3 className="font-semibold text-xl tracking-[-0.01em]">Environment</h3>
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 font-mono text-xs">
                {(
                  [
                    ['date', s.date.replace('T', ' ').slice(0, 16) + ' UTC'],
                    ['machine', machine],
                    ['os', env.osName ? `${env.osName} (${env.os})` : env.os],
                    ['node', env.node],
                    ['browser', `Chromium ${env.chromium} (Playwright ${env.playwright}), headless, ${env.method.viewport}`],
                    ['commit', `${env.git ?? '?'}${env.dirty ? ' + local changes' : ''}`],
                    ['duration', `${env.durationMin} min`],
                    ...Object.entries(env.libraries).map(([k, v]) => [k, v ?? '—']),
                  ] as [string, string][]
                ).map(([k, v]) => (
                  <div className="contents" key={k}>
                    <dt className="text-muted-foreground">{k}</dt>
                    <dd className="break-words text-foreground">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </div>
        <div className="border-t">
          <CopyLine command="pnpm install && pnpm --filter cqb-bench suite" label="reproduce" />
        </div>
        <p className="border-t px-4 py-5 text-muted-foreground text-sm leading-relaxed sm:px-8">
          The harness, adapters and raw JSON are in{' '}
          <a className="underline underline-offset-2 hover:text-foreground" href={`${GITHUB_URL}/tree/main/bench`}>
            bench/ on GitHub
          </a>
          : <code className="font-mono">results/suite.json</code> holds every number on this page. A slice runs in a minute:{' '}
          <code className="font-mono">ONLY=qnot,rqb SIZES=100,1000 node suite.mjs --no-core --no-throttle</code>.
        </p>
      </Section>

      <Section id="caveats-title" intro="Read these before quoting a number." title="Caveats.">
        <div className="px-4 py-8 sm:px-8">
          <Prose>
            {wins.length > 0 && (
              <>
                <h3>Where another library wins</h3>
                <ul>
                  {wins.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </>
            )}
            {weaker.length > 0 && (
              <>
                <h3>Where qnot is weaker</h3>
                <ul>
                  {weaker.map((w) => (
                    <li key={w}>{w}</li>
                  ))}
                </ul>
              </>
            )}
            <h3>Design differences, not bugs</h3>
            <ul>
              <li>DevExtreme shows values as text and opens an editor on click, so it has no inline typing path (no keystroke number) and far fewer DOM nodes.</li>
              <li>jQuery QueryBuilder keeps its state in the DOM and jQuery data, so its JS heap is small; its DOM node count is the fairer memory proxy.</li>
              <li>react-awesome-query-builder moves rules live while the pointer moves; its drag number is the release only. react-querybuilder, jQuery QueryBuilder (plugin), Syncfusion (opt-in) and DevExtreme have no drag and drop in the default setup.</li>
              <li>Syncfusion and DevExtreme run unlicensed with their trial banner; behaviour is otherwise the same.</li>
              <li>qnot's selects fill their option lists on first focus, so "change field" includes that work for qnot and not for libraries that render every option up front.</li>
            </ul>
            <h3>Noise</h3>
            <ul>
              <li>Sub-millisecond timings are close to the browser timer's resolution (Chromium coarsens <code>performance.now()</code> without cross-origin isolation), so 0.3 vs 0.4 ms is a tie.</li>
              <li>Heap numbers move with GC timing by a few hundred KB; the throttled pass uses fewer samples than the main run.</li>
              {noisy.length > 0 && (
                <li>
                  {noisy.length} of {measured} medians from 100 rules up have a p25–p75 range wider than ±25% of the median, mostly interactions at 2,500 and 5,000 rules, which run 6 times
                  rather than 12. The widest: {noisy.slice(0, 4).map((x) => x.text).join('; ')}. The table view of each chart shows every range.
                </li>
              )}
              {retried.length > 0 && (
                <li>
                  A fresh page that never finished its first render within 60 s was replaced by another fresh page, once, for: {retried.join(', ')}. The same happened once in an earlier run at
                  a different size, so it looks like an intermittent hang rather than a size limit; the JSON records it.
                </li>
              )}
              {skippedAll.length > 0 && <li>Skipped sizes (projected over the time budget, recorded in the JSON): {skippedAll.join(', ')}.</li>}
              <li>One machine, one browser, one run. Absolute numbers will differ on yours; compare ratios, and rerun the suite to check them.</li>
            </ul>
          </Prose>
        </div>
      </Section>

      <EndLinks
        items={[
          { href: '/compare', label: 'Compare query builders' },
          { href: '/playground', label: 'Playground' },
          { href: '/docs', label: 'Docs' },
        ]}
      />
    </Sheet>
  );
}

function HeadlineTable({ n }: { n: number }) {
  const max = Object.fromEntries(HEADLINE.map((h) => [h.key, Math.max(...TABLE_IDS.map((id) => med(id, n, h.key) ?? 0))]));
  return (
    <ScrollArea className="border-t" clampContentMinWidth={false} scrollFade>
      <table className="w-full min-w-[60rem] border-collapse text-sm">
        <caption className="sr-only">Every library at {n.toLocaleString('en-US')} rules, medians</caption>
        <thead>
          <tr className="border-b">
            <th className="px-4 py-3 text-left font-mono font-normal text-muted-foreground text-xs sm:px-8" scope="col">
              library
            </th>
            {HEADLINE.map((h) => (
              <th className="px-3 py-3 text-left font-mono font-normal text-muted-foreground text-xs" key={h.key} scope="col">
                {h.label.toLowerCase()}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TABLE_IDS.map((id) => {
            const a = adapter(id);
            const p = at(id, n);
            const notes = libNotes(suite().ui.results[id] ?? {});
            return (
              <tr className={cn('border-b last:border-b-0', a.us && 'bg-muted/30')} key={id}>
                <th className="sticky left-0 z-10 max-w-44 bg-background px-4 py-3.5 text-left font-normal sm:max-w-none sm:px-8" scope="row">
                  <span className="flex items-center gap-2">
                    <span aria-hidden className="size-2 shrink-0 rounded-full" style={{ background: colorOf(id) }} />
                    <span className={cn('font-medium', !a.us && 'text-foreground/80')}>{a.name}</span>
                  </span>
                  <span className="ms-4 block truncate font-mono text-muted-foreground text-xs sm:inline">
                    {a.pkg} {versionOf(a)}
                  </span>
                </th>
                {HEADLINE.map((h) => {
                  const v = med(id, n, h.key);
                  const c = cell(p, h.key, notes);
                  return (
                    <td className="px-3 py-3.5 align-top" key={h.key} title={c.why}>
                      {v == null ? (
                        <span className="font-mono text-muted-foreground text-xs">{c.why?.startsWith('n/a') ? 'n/a' : (c.why?.split(' ')[0] ?? '—')}</span>
                      ) : (
                        <>
                          <span className={cn('font-mono tabular-nums', !a.us && 'text-foreground/80')}>{fmt(v, h.unit)}</span>
                          <span aria-hidden className="mt-1.5 block h-1 w-full max-w-24 rounded-full bg-foreground/8">
                            <span className={cn('block h-full rounded-full', a.us ? 'bg-teal-500 dark:bg-teal-400' : 'bg-foreground/30')} style={{ width: `${Math.max(2, (v / (max[h.key] || 1)) * 100)}%` }} />
                          </span>
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </ScrollArea>
  );
}
