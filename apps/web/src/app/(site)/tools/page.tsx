import { ArrowRightIcon, LockIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { CatalogCard, CatalogGrid } from '@/components/catalog';
import { Sketch } from '@/components/catalog/drawing';
import { BreadcrumbJsonLd, JsonLd } from '@/components/seo/json-ld';
import { absoluteUrl, pageMetadata } from '@/lib/seo';
import { TOOLS } from '@/tools/catalog';
import { FORMATS } from '@/tools/formats';

export const metadata: Metadata = pageMetadata({
  title: 'Free Query Converters: SQL, MongoDB, JsonLogic, RQB',
  description:
    'Free online query converters: SQL to MongoDB, JsonLogic to SQL, react-querybuilder and RAQB JSON to SQL, SQL to Elasticsearch. Runs in your browser, no sign-up.',
  path: '/tools',
});

/** The card drawing: the source as a code block, an arrow, the target. */
function Pair({ from, to }: { from: string; to: string }) {
  return (
    <div className="flex flex-col gap-2">
      <Sketch.Panel className="gap-2 p-2.5">
        <span className="font-mono text-[0.625rem] text-muted-foreground">{from}</span>
        <Sketch.Code lines={[16, 22, 12]} />
      </Sketch.Panel>
      <svg aria-hidden className="mx-auto h-5 w-3 text-foreground/40" fill="none" viewBox="0 0 12 20">
        <path d="M6 1v17M2 14l4 4 4-4" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.3" />
      </svg>
      <Sketch.Panel className="gap-2 border-teal-500/40 p-2.5">
        <span className="font-mono text-[0.625rem] text-teal-700 dark:text-teal-300">{to}</span>
        <Sketch.Code lines={[10, 18, 14]} />
      </Sketch.Panel>
    </div>
  );
}

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1">
      <BreadcrumbJsonLd crumbs={[{ name: 'Tools', path: '/tools' }]} />
      <JsonLd
        data={{
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'qnot query converters',
          itemListElement: TOOLS.map((t, i) => ({ '@type': 'ListItem', position: i + 1, name: t.title, url: absoluteUrl(`/tools/${t.slug}`) })),
        }}
      />
      <section className="border-b">
        <div className="flex flex-col gap-6 px-4 pt-12 pb-10 sm:px-8 sm:pt-16 lg:grid lg:grid-cols-12 lg:items-end lg:gap-10">
          <h1 className="text-balance font-semibold text-[clamp(2.5rem,5.5vw,4.5rem)] leading-[0.92] tracking-[-0.035em] lg:col-span-8">Convert any query, in your browser.</h1>
          <div className="flex flex-col gap-4 lg:col-span-4 lg:pb-2">
            <p className="max-w-md text-lg text-muted-foreground leading-snug">
              Free converters between SQL, MongoDB, JsonLogic, Elasticsearch and the JSON of other query builders. Paste, pick a dialect, copy.
            </p>
            <p className="flex items-center gap-1.5 font-mono text-muted-foreground text-xs">
              <LockIcon className="size-3.5" /> nothing leaves your browser
            </p>
          </div>
        </div>
      </section>
      <section className="px-4 py-8 sm:px-8 sm:py-10">
        <CatalogGrid>
          {TOOLS.map((t) => (
            <CatalogCard
              description={t.lede}
              href={`/tools/${t.slug}`}
              key={t.slug}
              tag={t.to.length > 1 ? `${t.to.length} outputs` : 'free'}
              title={t.title}
            >
              <Pair from={FORMATS[t.from].short} to={t.to.map((x) => FORMATS[x].short).join(' · ')} />
            </CatalogCard>
          ))}
        </CatalogGrid>
      </section>
      <section className="grid grid-cols-1 border-t md:grid-cols-3 md:divide-x">
        {[
          { title: 'Schema inferred', body: 'Paste any query: field kinds come from the values, so numbers stay numbers and dates stay dates. Open the schema panel to see what was inferred.' },
          { title: 'Errors you can act on', body: "When a format can't express something, you get the rule, the reason and what to change, never a silently wider query." },
          { title: 'The same code in your app', body: "Each tool shows the two calls it makes. They're qnot's codecs: MIT, typed, and the same on the server and in the browser." },
        ].map((item) => (
          <div className="flex flex-col gap-2 border-b px-4 py-8 sm:px-8 md:border-b-0" key={item.title}>
            <span className="font-medium text-lg">{item.title}</span>
            <p className="text-muted-foreground leading-snug">{item.body}</p>
          </div>
        ))}
      </section>
      <div className="flex flex-wrap gap-x-6 gap-y-2 border-t px-4 py-6 text-sm sm:px-8">
        {[
          { label: 'Format codecs in the docs', href: '/docs/concepts/formats' },
          { label: 'Open the playground', href: '/playground' },
          { label: 'Get started', href: '/docs' },
        ].map((l) => (
          <Link className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground" href={l.href} key={l.href}>
            {l.label} <ArrowRightIcon className="size-3.5" />
          </Link>
        ))}
      </div>
    </main>
  );
}
