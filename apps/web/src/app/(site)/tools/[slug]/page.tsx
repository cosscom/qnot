import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { BreadcrumbJsonLd, FaqJsonLd, JsonLd } from '@/components/seo/json-ld';
import { pageMetadata, webAppLd } from '@/lib/seo';
import { TOOLS, toolBySlug } from '@/tools/catalog';
import { Converter } from '@/tools/converter';
import { FORMATS } from '@/tools/formats';

export const generateStaticParams = () => TOOLS.map((t) => ({ slug: t.slug }));
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const tool = toolBySlug((await params).slug);
  if (!tool) return {};
  return pageMetadata({ title: tool.metaTitle, description: tool.description, path: `/tools/${tool.slug}` });
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const tool = toolBySlug(slug);
  if (!tool) notFound();
  const path = `/tools/${tool.slug}`;
  const others = TOOLS.filter((t) => t.slug !== tool.slug);
  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1">
      <BreadcrumbJsonLd
        crumbs={[
          { name: 'Tools', path: '/tools' },
          { name: tool.title, path },
        ]}
      />
      <JsonLd data={webAppLd({ name: tool.title, description: tool.description, path })} />
      <FaqJsonLd faq={tool.faq} />

      <section className="border-b">
        <div className="flex flex-col gap-6 px-4 pt-10 pb-8 sm:px-8 lg:grid lg:grid-cols-12 lg:items-end lg:gap-10">
          <div className="flex flex-col gap-4 lg:col-span-8">
            <Link className="inline-flex w-fit items-center gap-1.5 font-mono text-muted-foreground text-xs hover:text-foreground" href="/tools">
              <ArrowLeftIcon className="size-3.5" /> tools
            </Link>
            <h1 className="text-balance font-semibold text-[clamp(2.25rem,4.5vw,3.5rem)] leading-[0.95] tracking-[-0.03em]">{tool.title}</h1>
            <p className="max-w-2xl text-lg text-muted-foreground leading-snug">{tool.lede}</p>
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-muted-foreground text-xs lg:col-span-4 lg:justify-end lg:pb-1">
            <li>free</li>
            <li>no sign-up</li>
            <li>runs in your browser</li>
            <li>MIT</li>
          </ul>
        </div>
      </section>

      {/* Server-rendered with the sample converted; live once hydrated. */}
      <Converter
        notes={tool.notes.map((n) => (
          <p key={n}>{n}</p>
        ))}
        slug={tool.slug}
      />

      <section aria-labelledby="faq-title" className="grid gap-6 border-b px-4 py-10 sm:px-8 lg:grid-cols-12 lg:gap-10">
        <h2 className="font-semibold text-2xl tracking-[-0.02em] lg:col-span-4" id="faq-title">
          Questions
        </h2>
        <dl className="flex flex-col divide-y border-y lg:col-span-8">
          {tool.faq.map((item) => (
            <div className="grid gap-2 py-5 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] sm:gap-8" key={item.q}>
              <dt className="font-medium">{item.q}</dt>
              <dd className="text-muted-foreground leading-relaxed">{item.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section aria-labelledby="more-title">
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b px-4 pt-10 pb-6 sm:px-8">
          <h2 className="font-semibold text-2xl tracking-[-0.02em]" id="more-title">
            More converters
          </h2>
          <Link className="inline-flex items-center gap-1.5 text-muted-foreground text-sm hover:text-foreground" href="/docs/concepts/formats">
            Every format qnot speaks <ArrowRightIcon className="size-3.5" />
          </Link>
        </div>
        <ul className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4">
          {others.map((t) => (
            <li className="border-b sm:odd:border-r xl:border-r xl:[&:nth-child(4n)]:border-r-0" key={t.slug}>
              <Link className="flex h-full flex-col gap-2 px-4 py-6 transition-colors hover:bg-muted/40 sm:px-8" href={`/tools/${t.slug}`}>
                <span className="font-mono text-muted-foreground text-xs">
                  {FORMATS[t.from].short} → {t.to.map((x) => FORMATS[x].short).join(' · ')}
                </span>
                <span className="font-medium text-lg">{t.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
