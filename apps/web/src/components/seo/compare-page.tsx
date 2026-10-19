import 'server-only';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BookOpenIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CodePanel } from '@/components/catalog/code-panel';
import { Button } from '@/components/ui/button';
import { libInfo, times, type LibId } from '@/lib/bench-series';
import { GITHUB_URL, withBrand } from '@/lib/site';
import { cn } from '@/lib/utils';
import { BenchNote, BenchTable, metricValue } from './bench-tables';
import { EndLinks, FaqSection, LinkGrid, PageHero, Prose, Section, Sheet, type FaqItem } from './blocks';
import { COMPARES } from './shared';

export type Competitor = keyof typeof COMPARES;

/** A code snippet from ./snippets, type-checked with the site and shown as written. */
export const snippet = (file: string) => withBrand(readFileSync(join(process.cwd(), 'src', 'components', 'seo', 'snippets', file), 'utf8'));

export interface FeatureRow {
  feature: string;
  qnot: string;
  them: string;
  /** Who's ahead on this row, if anyone; drawn as a small mark, never as the only signal. */
  edge?: 'qnot' | 'them';
}

export interface ComparePageProps {
  /** The page's path, for its BreadcrumbList. */
  path?: string;
  id: Competitor;
  title: string;
  lede: ReactNode;
  /** qnot build to measure against: the React one for React libraries, the DOM one otherwise. */
  ours: ('qnot' | 'qnot-dom')[];
  features: FeatureRow[];
  /** Where the other library is the better pick. */
  better: ReactNode;
  benchIntro: ReactNode;
  switching: { intro: ReactNode; file: string; lang: string; title: string; after?: ReactNode };
  faq: readonly FaqItem[];
  docs?: { href: string; label: string };
}

function Fact({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1 border-r border-b px-4 py-5 sm:px-8">
      <span className="font-mono text-muted-foreground text-xs">{label}</span>
      <span className="font-medium text-lg tabular-nums">{value}</span>
      {note && <span className="text-muted-foreground text-sm">{note}</span>}
    </div>
  );
}

export function ComparePage(props: ComparePageProps) {
  const them = libInfo(props.id);
  const us = props.ours[0]!;
  const ratio = (m: 'mount' | 'keystroke' | 'add' | 'heap' | 'js') => times(metricValue(us, m), metricValue(props.id, m));
  const v = (id: LibId, m: 'mount' | 'keystroke' | 'add' | 'heap' | 'js') => metricValue(id, m);
  const fmt = (n: number | null, unit: string) => (n === null ? 'n/a' : `${n >= 100 ? Math.round(n).toLocaleString('en-US') : n} ${unit}`);
  return (
    <Sheet path={props.path}>
      <PageHero
        actions={
          <>
            <Button className="px-4" render={<Link href="#switching" />}>
              Switching
            </Button>
            <Button className="px-4" render={<Link href={props.docs?.href ?? '/docs'} />} variant="outline">
              <BookOpenIcon />
              {props.docs?.label ?? 'Docs'}
            </Button>
          </>
        }
        crumb={{ href: '/compare', label: 'compare' }}
        lede={props.lede}
        tags={[`${them.pkg} ${them.version}`, them.license]}
        title={props.title}
      />
      <section aria-label="At a glance" className="overflow-hidden border-b">
        <div className="-me-px -mb-px grid grid-cols-2 lg:grid-cols-4">
          <Fact label="license" note={`${them.name}: ${them.license}`} value="qnot: MIT" />
          <Fact label="first render, 1,000 rules" note={`${them.name}: ${fmt(v(props.id, 'mount'), 'ms')}`} value={`qnot: ${fmt(v(us, 'mount'), 'ms')}`} />
          <Fact
            label="keystroke, 1,000 rules"
            note={`${them.name}: ${fmt(v(props.id, 'keystroke'), 'ms')}${v(props.id, 'keystroke') === null ? ' (no inline editing)' : ''}`}
            value={`qnot: ${fmt(v(us, 'keystroke'), 'ms')}`}
          />
          <Fact label="JS, gzipped" note={`${them.name}: ${fmt(v(props.id, 'js'), 'KB')}`} value={`qnot: ${fmt(v(us, 'js'), 'KB')}`} />
        </div>
      </section>
      <Section id="features-title" intro="What each library does out of the box, from its docs, its package contents and our own harness. Where it says no, an add-on or your own code may still get you there." title="Feature by feature.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] border-collapse text-sm">
            <caption className="sr-only">{`Features of qnot and ${them.name}`}</caption>
            <thead>
              <tr className="border-b">
                <th className="w-[22%] px-4 py-3 text-left font-mono font-normal text-muted-foreground text-xs sm:px-8" scope="col">
                  feature
                </th>
                <th className="w-[39%] px-4 py-3 text-left font-mono font-normal text-muted-foreground text-xs" scope="col">
                  qnot
                </th>
                <th className="w-[39%] px-4 py-3 text-left font-mono font-normal text-muted-foreground text-xs" scope="col">
                  {them.name}
                </th>
              </tr>
            </thead>
            <tbody>
              {props.features.map((row) => (
                <tr className="border-b align-top last:border-b-0" key={row.feature}>
                  <th className="px-4 py-4 text-left font-medium sm:px-8" scope="row">
                    {row.feature}
                  </th>
                  <td className={cn('px-4 py-4 leading-snug', row.edge === 'qnot' && 'bg-teal-500/6')}>
                    {row.qnot}
                    {row.edge === 'qnot' && <span className="sr-only"> (qnot ahead)</span>}
                  </td>
                  <td className={cn('px-4 py-4 leading-snug', row.edge === 'them' && 'bg-foreground/4')}>
                    {row.them}
                    {row.edge === 'them' && <span className="sr-only"> ({them.name} ahead)</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>
      <Section id="bench-title" intro={props.benchIntro} title="Measured at 1,000 rules.">
        <BenchTable caption={`qnot and ${them.name} at 1,000 rules`} ids={[...props.ours, props.id]} />
        <BenchNote>
          {ratio('mount') && `${them.name} takes ${ratio('mount')} as long to render. `}
          <a className="underline underline-offset-2 hover:text-foreground" href={`${GITHUB_URL}/tree/main/bench`}>
            The harness, its method and every size
          </a>
          .
        </BenchNote>
      </Section>
      <Section id="better-title" intro={`An honest list. If one of these is you, ${them.name} may serve you better.`} title={`When ${them.name} is the better choice.`}>
        <div className="px-4 py-8 sm:px-8">
          <Prose>{props.better}</Prose>
        </div>
      </Section>
      <section aria-labelledby="switching-title" className="scroll-mt-14 border-b" id="switching">
        <div className="grid gap-4 border-b px-4 pt-14 pb-8 sm:px-8 sm:pt-20 lg:grid-cols-12 lg:gap-10">
          <h2 className="text-balance font-semibold text-3xl tracking-[-0.03em] sm:text-[2.75rem] sm:leading-[1.05] lg:col-span-6" id="switching-title">
            Switching.
          </h2>
          <div className="max-w-xl text-lg text-muted-foreground leading-snug lg:col-span-5 lg:col-start-8 lg:pt-1.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_code]:text-foreground">{props.switching.intro}</div>
        </div>
        <div className="grid grid-cols-1 gap-6 px-4 py-8 sm:px-8 lg:grid-cols-12">
          <CodePanel className="lg:col-span-8" code={snippet(props.switching.file)} lang={props.switching.lang} title={props.switching.title} />
          {props.switching.after && (
            <div className="lg:col-span-4">
              <Prose className="text-base text-muted-foreground">{props.switching.after}</Prose>
            </div>
          )}
        </div>
      </section>
      <FaqSection items={props.faq} />
      <section aria-labelledby="more-title" className="border-b">
        <h2 className="sr-only" id="more-title">
          Other comparisons
        </h2>
        <LinkGrid
          columns={2}
          items={(Object.keys(COMPARES) as Competitor[])
            .filter((c) => c !== props.id)
            .map((c) => ({ name: `qnot vs ${libInfo(c).name}`, tag: libInfo(c).license, summary: COMPARES[c].summary, href: COMPARES[c].href }))}
        />
      </section>
      <EndLinks
        items={[
          { href: '/compare', label: 'All comparisons' },
          { href: '/#benchmarks', label: 'Benchmarks' },
          { href: '/playground', label: 'Try the playground' },
          { href: '/docs', label: 'Docs' },
        ]}
      />
    </Sheet>
  );
}

