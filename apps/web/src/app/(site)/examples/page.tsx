import type { Metadata } from 'next';
import { CatalogCard } from '@/components/catalog';
import { EXAMPLES } from '@/examples/catalog';
import { CategoryFilter } from '@/examples/category-filter';
import { SKETCHES } from '@/examples/sketches';
import { BreadcrumbJsonLd } from '@/components/seo/json-ld';
import { pageMetadata } from '@/lib/seo';

export const metadata: Metadata = pageMetadata({
  title: 'Query Builder Examples: Filters, Segments, Rules',
  description:
    'Query builder examples: filter bars, CRM segments, feature flags, alert rules, access policies and more, each a working app with full source you can install.',
  path: '/examples',
});

export default function Page() {
  const cards = EXAMPLES.map((e) => {
    const Drawing = SKETCHES[e.slug]!;
    return {
      slug: e.slug,
      category: e.category,
      node: (
        <CatalogCard description={e.blurb} href={`/examples/${e.slug}`} key={e.slug} tag={e.category.toLowerCase()} title={e.title}>
          <Drawing />
        </CatalogCard>
      ),
    };
  });
  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1">
      <BreadcrumbJsonLd crumbs={[{ name: 'Examples', path: '/examples' }]} />
      <section className="border-b">
        <div className="flex flex-col gap-6 px-4 pt-12 pb-10 sm:px-8 sm:pt-16 lg:grid lg:grid-cols-12 lg:items-end lg:gap-10">
          <h1 className="text-balance font-semibold text-[clamp(2.5rem,5.5vw,4.5rem)] leading-[0.92] tracking-[-0.035em] lg:col-span-8">What people build with a query builder.</h1>
          <p className="max-w-md text-lg text-muted-foreground leading-snug lg:col-span-4 lg:pb-2">
            Each example is a working app on the same store: different UI, different output, same typed query underneath.
          </p>
        </div>
      </section>
      <section className="px-4 py-8 sm:px-8 sm:py-10">
        <CategoryFilter cards={cards} />
      </section>
    </main>
  );
}
