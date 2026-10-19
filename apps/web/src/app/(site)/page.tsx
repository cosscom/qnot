import { ArrowRightIcon, BookOpenIcon, LayoutGridIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CopyLine } from '@/components/site/copy-line';
import { DropInDrawing, EditsDrawing, FormatsDrawing, FrameworksDrawing, HeroDrawing, ServerDrawing, TypedDrawing } from '@/components/drawings/drawings';
import { Stage } from '@/components/drawings/stage';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GITHUB_URL, INSTALL, SITE_DESCRIPTION, SITE_TITLE } from '@/lib/site';
import { benchAt1000 } from '@/lib/bench';

export const metadata: Metadata = { title: { absolute: SITE_TITLE }, description: SITE_DESCRIPTION };

// qnot's landing page, drawn like coss.com/shipyard's: one ruled sheet between the shell's
// rails, each section closing with a hairline. The drawings are components/drawings; each sits in
// a Stage, which drops its parts in when it scrolls into view.
export default function Page() {
  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1">
      <Hero />
      <WorksWith />
      <Features />
      <Benchmarks />
      <Yard />
      <Install />
    </main>
  );
}

function Hero() {
  return (
    <section aria-labelledby="hero-title" className="border-b">
      <div className="flex flex-col gap-8 px-4 pt-12 pb-10 sm:px-8 sm:pt-16 lg:grid lg:grid-cols-12 lg:items-end lg:gap-10 lg:pb-12">
        <h1 className="text-balance font-semibold text-[clamp(2.75rem,6.5vw,5.25rem)] leading-[0.92] tracking-[-0.035em] lg:col-span-8" id="hero-title">
          A query builder that stays fast at a thousand rules.
        </h1>
        <div className="flex flex-col gap-6 lg:col-span-4 lg:pb-2">
          <p className="max-w-md text-lg text-muted-foreground leading-snug">
            qnot is typed from your schema to the SQL it writes, runs in React, Vue, Svelte, Solid or plain JS, and wears any UI kit. Editing one rule re-renders one
            rule. About 15 KB.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <Button className="px-4" render={<Link href="/docs" />}>
              <BookOpenIcon />
              Get started
            </Button>
            <Button className="px-4" render={<Link href="/examples" />} variant="outline">
              <LayoutGridIcon />
              Browse examples
            </Button>
          </div>
          <p className="font-mono text-muted-foreground text-xs">MIT · TypeScript · server and browser</p>
        </div>
      </div>
      <Stage className="drafting-grid flex items-center justify-center overflow-hidden border-t px-4 py-10 sm:py-12">
        <HeroDrawing className="w-full max-w-7xl" />
      </Stage>
    </section>
  );
}

const FRAMEWORKS = ['React', 'Vue', 'Svelte', 'Solid', 'Vanilla JS'];
const KITS = ['coss ui', 'shadcn/ui', 'MUI', 'Mantine', 'your own'];

function WorksWith() {
  return (
    <section aria-label="Works with" className="flex flex-col divide-y border-b lg:flex-row lg:divide-x lg:divide-y-0">
      <div className="flex flex-1 flex-col gap-3 px-4 py-6 sm:px-8 xl:flex-row xl:items-center xl:gap-8">
        <span className="w-24 shrink-0 font-mono text-muted-foreground text-xs">frameworks</span>
        <ul className="flex flex-1 flex-wrap gap-x-7 gap-y-2 font-medium text-foreground/80 text-lg">
          {FRAMEWORKS.map((f) => (
            <li key={f}>{f}</li>
          ))}
        </ul>
      </div>
      <div className="flex flex-1 flex-col gap-3 px-4 py-6 sm:px-8 xl:flex-row xl:items-center xl:gap-8">
        <span className="w-24 shrink-0 font-mono text-muted-foreground text-xs">any UI kit</span>
        <ul className="flex flex-1 flex-wrap gap-x-7 gap-y-2 font-medium text-foreground/80 text-lg">
          {KITS.map((k) => (
            <li key={k}>{k}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function SectionHead({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <div className="grid gap-4 border-b px-4 pt-16 pb-10 sm:px-8 sm:pt-24 lg:grid-cols-12 lg:gap-10">
      <h2 className="text-balance font-semibold text-4xl tracking-[-0.03em] sm:text-5xl lg:col-span-6" id={id}>
        {title}
      </h2>
      <div className="max-w-xl text-lg text-muted-foreground leading-snug lg:col-span-5 lg:col-start-8 lg:pt-2">{children}</div>
    </div>
  );
}

const FEATURES: { title: string; tags: string; summary: ReactNode; drawing: ReactNode; href: string }[] = [
  {
    title: 'Typed end to end',
    tags: 'defineFields · QueryOf · RowOf',
    summary: (
      <>
        Declare fields once. Every rule's value narrows by field and operator, so <code className="font-mono text-[0.9em]">'gold'</code> on an enum of{' '}
        <code className="font-mono text-[0.9em]">'free' | 'pro'</code> is a type error, and validated queries come back strict.
      </>
    ),
    drawing: <TypedDrawing />,
    href: '/docs/concepts/schema',
  },
  {
    title: 'One rule, one re-render',
    tags: 'normalized store · per-node subscriptions',
    summary: 'The store keeps every node by id and tells only the node that changed. A keystroke costs the same at ten rules or a thousand: half a millisecond.',
    drawing: <EditsDrawing />,
    href: '/docs/concepts/store',
  },
  {
    title: 'Every format',
    tags: 'SQL · Mongo · JsonLogic · Elasticsearch · SpEL',
    summary: 'Export to SQL with parameters in five dialects, MongoDB, JsonLogic, Elasticsearch and SpEL, and read react-querybuilder, RAQB and jQuery QueryBuilder JSON both ways.',
    drawing: <FormatsDrawing />,
    href: '/docs/concepts/formats',
  },
  {
    title: 'Five frameworks, one store',
    tags: 'React · Vue · Svelte · Solid · DOM',
    summary: 'The core is plain TypeScript. Each binding is hooks over the same store, plus a small unstyled builder you can swap out piece by piece.',
    drawing: <FrameworksDrawing />,
    href: '/docs/guides/react',
  },
  {
    title: 'Runs on the server',
    tags: 'validate · compile · parameterized SQL',
    summary: 'Share one fields.ts. The browser builds the query; the server validates it, narrows its type, and turns it into SQL with bound parameters, or filters rows in memory.',
    drawing: <ServerDrawing />,
    href: '/docs/guides/server',
  },
  {
    title: 'Drop-in for your saved queries',
    tags: 'format: rqb · format: raqb',
    summary: "Give the store a format and value / onChange speak react-querybuilder's or RAQB's JSON. Keep your stored queries; swap the library underneath.",
    drawing: <DropInDrawing />,
    href: '/docs/guides/migrate-react-querybuilder',
  },
];

function Features() {
  return (
    <section aria-labelledby="features-title" className="scroll-mt-14 border-b" id="features">
      <SectionHead id="features-title" title="Built for queries people actually build.">
        Filters, segments, routing rules, alert thresholds, access policies. qnot is the part they all share: a typed tree, edited fast, exported anywhere.
      </SectionHead>
      <div className="grid grid-cols-1 md:grid-cols-2">
        {FEATURES.map((feature, index) => (
          <article aria-labelledby={`feature-${index}`} className="flex flex-col border-b last:border-b-0 md:odd:border-r md:[&:nth-last-child(-n+2)]:border-b-0" key={feature.title}>
            <Stage className="drafting-grid relative flex items-center justify-center overflow-hidden border-b">
              <span className="absolute top-4 left-4 font-mono text-muted-foreground text-xs sm:left-8">{String(index + 1).padStart(2, '0')}</span>
              <div className="w-full max-w-[720px]">{feature.drawing}</div>
            </Stage>
            <div className="flex flex-1 flex-col gap-4 px-4 py-8 sm:px-8">
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <h3 className="font-semibold text-3xl tracking-[-0.02em]" id={`feature-${index}`}>
                  {feature.title}
                </h3>
                <span className="font-mono text-muted-foreground text-sm">{feature.tags}</span>
              </div>
              <p className="max-w-lg text-lg leading-snug">{feature.summary}</p>
              <Link className="mt-auto inline-flex w-fit items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground" href={feature.href}>
                Read how <ArrowRightIcon className="size-3.5" />
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

/** The libraries in the landing table, in order; numbers come from bench/results at build time. */
const BENCH_LIBS = [
  { id: 'qnot', name: 'qnot', version: '0.1 · React UI', us: true },
  { id: 'rqb', name: 'react-querybuilder', version: '8.25' },
  { id: 'raqb', name: 'react-awesome-query-builder', version: '6.6' },
  { id: 'jqqb', name: 'jQuery QueryBuilder', version: '3.0', note: 'incl. jQuery' },
] as const;

const COLUMNS = [
  { key: 'mount', label: 'First render', unit: 'ms' },
  { key: 'keystroke', label: 'Keystroke', unit: 'ms' },
  { key: 'add', label: 'Add a rule', unit: 'ms' },
  { key: 'heap', label: 'Memory', unit: 'MB' },
  { key: 'js', label: 'JS, gzipped', unit: 'KB' },
] as const;

function Benchmarks() {
  const measured = benchAt1000(BENCH_LIBS.map((l) => l.id));
  const BENCH = BENCH_LIBS.map((lib, i) => ({ ...lib, ...measured.rows[i]! }));
  const worst = Object.fromEntries(COLUMNS.map((c) => [c.key, Math.max(...BENCH.map((b) => b[c.key] ?? 0))])) as Record<(typeof COLUMNS)[number]['key'], number>;
  return (
    <section aria-labelledby="bench-title" className="scroll-mt-14 border-b" id="benchmarks">
      <SectionHead id="bench-title" title="Measured, not claimed.">
        The same 1,000-rule tree in every library, production builds, headless Chromium. Lower is better; the bar is each number against the slowest.
      </SectionHead>
      <ScrollArea clampContentMinWidth={false} scrollFade>
        <table className="w-full min-w-[56rem] border-collapse text-sm">
          <thead>
            <tr className="border-b">
              <th className="px-4 py-3 text-left font-mono font-normal text-muted-foreground text-xs sm:px-8">library</th>
              {COLUMNS.map((c) => (
                <th className="px-4 py-3 text-left font-mono font-normal text-muted-foreground text-xs" key={c.key}>
                  {c.label.toLowerCase()}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {BENCH.map((row) => (
              <tr className={`border-b last:border-b-0 ${'us' in row ? 'bg-muted/30' : ''}`} key={row.name}>
                <th className="px-4 py-5 text-left font-normal sm:px-8" scope="row">
                  <div className="flex items-baseline gap-2">
                    <span className={`font-medium text-base ${'us' in row ? '' : 'text-foreground/80'}`}>{row.name}</span>
                    <span className="font-mono text-muted-foreground text-xs">{row.version}</span>
                  </div>
                  {'note' in row && <span className="font-mono text-muted-foreground text-xs">{row.note}</span>}
                </th>
                {COLUMNS.map((c) => {
                  const v = row[c.key];
                  if (v === null) return <td className="px-4 py-5 align-top font-mono text-muted-foreground" key={c.key}>—</td>;
                  return (
                    <td className="px-4 py-5 align-top" key={c.key}>
                      <div className="flex items-baseline gap-1 tabular-nums">
                        <span className={`font-heading font-semibold text-lg ${'us' in row ? '' : 'text-foreground/80'}`}>{v}</span>
                        <span className="font-mono text-muted-foreground text-xs">{c.unit}</span>
                      </div>
                      <span className="mt-2 block h-1 w-full max-w-36 rounded-full bg-foreground/8">
                        <span className={`block h-full rounded-full ${'us' in row ? 'bg-teal-500 dark:bg-teal-400' : 'bg-foreground/30'}`} style={{ width: `${Math.max(2, (v / worst[c.key]) * 100)}%` }} />
                      </span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollArea>
      <div className="flex flex-col gap-2 border-t px-4 py-5 text-muted-foreground text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <p className="max-w-3xl">
          Run of {measured.date}: Apple M5, Chromium via Playwright 1.64, no CPU throttling; medians of 5 fresh pages, 10 fields, 100 groups of 10 rules. JS is gzipped
          and excludes React (jQuery is included), and each bundle includes the library's own SQL/JSON export. With 4× CPU throttling the gaps widen.
        </p>
        <a className="inline-flex shrink-0 items-center gap-1.5 hover:text-foreground" href={`${GITHUB_URL}/tree/main/bench`}>
          Run the harness <ArrowRightIcon className="size-3.5" />
        </a>
      </div>
    </section>
  );
}

const YARD: { name: string; tag: string; summary: string; href: string }[] = [
  { name: 'Undo and redo', tag: 'history', summary: 'Every edit is a step; typing in one value merges into one. Batches are one step.', href: '/docs/reference/store#history' },
  { name: 'Drag and drop', tag: 'dnd', summary: 'Move rules and groups anywhere, with headless drag handles and drop targets in every binding.', href: '/docs/guides/react#drag-and-drop' },
  { name: 'Validation', tag: 'issues', summary: 'Per-node issues from the schema: required, min/max, patterns, options, your own checks. Messages are yours to translate.', href: '/docs/concepts/validation' },
  { name: 'Evaluate in JS', tag: 'compile()', summary: 'Compile a query once into a predicate and filter rows in the browser or on the server.', href: '/docs/concepts/evaluation' },
  { name: 'Lists and objects', tag: 'f.array · f.struct', summary: '"At least 3 orders where status is paid", and address.city as a field of its own.', href: '/docs/guides/arrays-and-structs' },
  { name: 'Functions', tag: 'lower() · relativeDate()', summary: 'Functions on either side of a rule, nestable, with output for each format.', href: '/docs/guides/operators-and-functions' },
  { name: 'Switch cases', tag: 'routing', summary: 'An ordered list of conditions with results: routing forms, pricing tiers, CASE WHEN.', href: '/docs/guides/routing-and-cases' },
  { name: 'Locks and limits', tag: 'settings', summary: 'Lock nodes, go read-only, cap rules and depth. The UI disables what the store would refuse.', href: '/docs/guides/settings' },
];

function Yard() {
  return (
    <section aria-labelledby="yard-title" className="border-b">
      <SectionHead id="yard-title" title="Everything else a query builder needs.">
        Feature parity with react-awesome-query-builder, and a few things it doesn't do. Every piece is in the docs.
      </SectionHead>
      <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
        {YARD.map((item) => (
          <li className="qn-yard border-b" key={item.name}>
            <Link className="flex h-full flex-col gap-2.5 px-4 py-7 transition-colors hover:bg-muted/40 sm:px-8" href={item.href}>
              <div className="flex items-baseline justify-between gap-4">
                <span className="font-medium text-lg">{item.name}</span>
                <span className="font-mono text-muted-foreground text-xs">{item.tag}</span>
              </div>
              <p className="text-muted-foreground leading-snug">{item.summary}</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

const STEPS: { title: string; body: ReactNode }[] = [
  { title: 'Install', body: <p>The core and the binding for your framework. React shown; Vue, Svelte, Solid and DOM have their own.</p> },
  {
    title: 'Define your fields',
    body: (
      <p>
        <code className="font-mono text-[0.9em] text-foreground">defineFields</code> with <code className="font-mono text-[0.9em] text-foreground">f.text()</code>,{' '}
        <code className="font-mono text-[0.9em] text-foreground">f.number()</code>, <code className="font-mono text-[0.9em] text-foreground">f.enum()</code>… Types flow from here.
      </p>
    ),
  },
  { title: 'Render a builder', body: <p>Drop in the unstyled builder, or build your own from the hooks with the UI kit you already use.</p> },
];

const ENDS = [
  { label: 'Read the docs', href: '/docs' },
  { label: 'Browse examples', href: '/examples' },
  { label: 'Open the playground', href: '/playground' },
  { label: 'llms.txt', href: '/llms.txt' },
  { label: 'GitHub', href: GITHUB_URL },
];

function Install() {
  return (
    <section aria-labelledby="install-title" className="scroll-mt-14" id="install">
      <SectionHead id="install-title" title="Cast the net.">
        Two packages, one schema, one component. Works the same on the server, minus the component.
      </SectionHead>
      <div className="border-b bg-background">
        <CopyLine command={INSTALL} label="in your app" />
      </div>
      <ol className="grid grid-cols-1 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <li className="flex flex-col gap-3 border-b px-4 py-8 text-muted-foreground leading-snug sm:px-8 md:border-r md:border-b-0 md:last:border-r-0" key={step.title}>
            <span className="flex size-6 items-center justify-center rounded-full border font-mono text-foreground text-xs">{index + 1}</span>
            <span className="font-medium text-foreground text-lg">{step.title}</span>
            {step.body}
          </li>
        ))}
      </ol>
      <div className="flex flex-wrap gap-x-6 gap-y-2 border-t px-4 py-6 text-sm sm:px-8">
        {ENDS.map((item) => (
          <Link className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground" href={item.href} key={item.label}>
            {item.label}
            <ArrowRightIcon className="size-3.5" />
          </Link>
        ))}
      </div>
    </section>
  );
}
