import { ArrowRightIcon } from 'lucide-react';
import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import Link from 'next/link';
import { BenchNote, BenchTable, metricValue } from '@/components/seo/bench-tables';
import { EndLinks, PageHero, Prose, Section, Sheet } from '@/components/seo/blocks';
import { type Competitor } from '@/components/seo/compare-page';
import { COMPARES } from '@/components/seo/shared';
import { LIBS, libInfo } from '@/lib/bench-series';
import { GITHUB_URL } from '@/lib/site';

export const metadata: Metadata = pageMetadata({
  title: 'Query builder comparison: qnot vs the alternatives',
  description:
    'Six JavaScript query builders compared on features, licensing, bundle size and measured speed at 1,000 rules, with notes on when each is the right pick.',
  path: '/compare',
});

const ORDER: Competitor[] = ['rqb', 'raqb', 'jqqb', 'syncfusion', 'devextreme'];

const FIT: Record<Competitor, string> = {
  rqb: 'React apps that need React Native or a rare export format',
  raqb: 'React apps on Ant Design or Fluent widgets',
  jqqb: 'apps on jQuery and Bootstrap with modest queries',
  syncfusion: 'teams already licensing Syncfusion, or building with Angular or Blazor',
  devextreme: 'apps built around the DevExtreme DataGrid',
};

export default function Page() {
  return (
    <Sheet path="/compare">
      <PageHero
        lede="Six JavaScript query builders, measured on the same 1,000-rule tree and compared feature by feature. Each page says where the other library is the better pick."
        tags={['measured', 'MIT and commercial', 'migration paths']}
        title="How qnot compares"
      />
      <section aria-labelledby="list-title" className="border-b">
        <h2 className="sr-only" id="list-title">
          Comparisons
        </h2>
        <ul>
          {ORDER.map((id) => {
            const lib = libInfo(id);
            const ours = lib.react ? 'qnot' : 'qnot-dom';
            return (
              <li className="border-b last:border-b-0" key={id}>
                <Link className="group relative grid gap-3 px-4 py-7 transition-colors hover:bg-muted/40 sm:px-8 lg:grid-cols-12 lg:items-baseline lg:gap-10 lg:pe-16" href={COMPARES[id].href}>
                  <div className="flex flex-col gap-1 lg:col-span-4">
                    <span className="font-semibold text-2xl tracking-[-0.02em]">qnot vs {lib.name}</span>
                    <span className="font-mono text-muted-foreground text-xs">
                      {lib.pkg} {lib.version} · {lib.license}
                    </span>
                  </div>
                  <p className="text-muted-foreground leading-snug lg:col-span-4">
                    {COMPARES[id].summary} <span className="text-foreground">Better for: {FIT[id]}.</span>
                  </p>
                  <dl className="flex gap-6 whitespace-nowrap font-mono text-xs lg:col-span-4">
                    <div>
                      <dt className="text-muted-foreground">render, 1k rules</dt>
                      <dd className="mt-1 text-base text-foreground tabular-nums">
                        {Math.round(metricValue(ours, 'mount') ?? 0)} vs {Math.round(metricValue(id, 'mount') ?? 0).toLocaleString('en-US')} ms
                      </dd>
                    </div>
                    <div>
                      <dt className="text-muted-foreground">JS gz</dt>
                      <dd className="mt-1 text-base text-foreground tabular-nums">
                        {metricValue(ours, 'js')} vs {metricValue(id, 'js')} KB
                      </dd>
                    </div>
                  </dl>
                  <ArrowRightIcon className="absolute top-9 right-8 hidden size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 lg:block" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
      <Section id="bench-title" intro="The same tree in every library, production builds, headless Chromium. The bar is each number against the largest in its column." title="All six at 1,000 rules.">
        <BenchTable caption="Every library at 1,000 rules" ids={LIBS.map((l) => l.id)} />
        <BenchNote>
          <a className="underline underline-offset-2 hover:text-foreground" href={`${GITHUB_URL}/tree/main/bench`}>
            The harness, its method and every size
          </a>
          .
        </BenchNote>
      </Section>
      <Section id="choose-title" intro="Speed matters only past a few hundred rules. Below that, pick on fit." title="How to choose.">
        <div className="px-4 py-8 sm:px-8">
          <Prose>
            <ul>
              <li>
                <strong>Large or generated queries, any framework:</strong> qnot. Editing stays under a millisecond at 1,000 rules in React or plain DOM.
              </li>
              <li>
                <strong>Vue, Svelte or Solid without a commercial license:</strong> qnot has native bindings for each (
                <Link href="/vue-query-builder">Vue</Link>, <Link href="/svelte-query-builder">Svelte</Link>, <Link href="/solid-query-builder">Solid</Link>).
              </li>
              <li>
                <strong>A shadcn/ui or MUI app:</strong> qnot's <Link href="/shadcn-query-builder">shadcn/ui</Link> and <Link href="/mui-query-builder">MUI</Link> builders
                install as source.
              </li>
              {ORDER.map((id) => (
                <li key={id}>
                  <strong>{FIT[id][0]!.toUpperCase() + FIT[id].slice(1)}:</strong> <Link href={COMPARES[id].href}>{libInfo(id).name}</Link> may be the better fit.
                </li>
              ))}
            </ul>
          </Prose>
        </div>
      </Section>
      <EndLinks
        items={[
          { href: '/benchmarks', label: 'Benchmarks' },
          { href: '/react-query-builder', label: 'React query builder' },
          { href: '/javascript-query-builder', label: 'JavaScript query builder' },
          { href: '/playground', label: 'Playground' },
        ]}
      />
    </Sheet>
  );
}
