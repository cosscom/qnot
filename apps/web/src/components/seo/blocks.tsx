import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { FaqJsonLd, SeoRouteJsonLd } from './json-ld';

/*
 * The pieces the search-landing pages (frameworks, kits, comparisons, articles) are built from,
 * drawn like the landing page: one ruled sheet, each section closing with a hairline.
 */

export interface FaqItem {
  q: string;
  /** Plain text, so the same string can feed structured data. */
  a: string;
  /** Optional follow-up links shown under the answer. */
  links?: { href: string; label: string }[];
}

/** The page's sheet. `path` adds the page's BreadcrumbList (structured data) from lib/seo-routes.ts. */
export function Sheet({ children, path }: { children: ReactNode; path?: string }) {
  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1">
      {path && <SeoRouteJsonLd path={path} />}
      {children}
    </main>
  );
}

/** The page head: a mono breadcrumb, the h1, a lede, mono tags and actions. */
export function PageHero({
  crumb,
  title,
  lede,
  tags = [],
  actions,
  aside,
}: {
  crumb?: { href: string; label: string };
  title: ReactNode;
  lede: ReactNode;
  tags?: string[];
  actions?: ReactNode;
  /** Right column on large screens (a stat, a note); the lede moves under the title when set. */
  aside?: ReactNode;
}) {
  return (
    <section aria-labelledby="page-title" className="border-b">
      <div className="flex flex-col gap-6 px-4 pt-10 pb-8 sm:px-8 sm:pt-14 lg:grid lg:grid-cols-12 lg:items-end lg:gap-10 lg:pb-10">
        <div className="flex flex-col gap-5 lg:col-span-8">
          {crumb && (
            <Link className="inline-flex w-fit items-center gap-1.5 font-mono text-muted-foreground text-xs hover:text-foreground" href={crumb.href}>
              <ArrowLeftIcon className="size-3.5" /> {crumb.label}
            </Link>
          )}
          <h1 className="text-balance font-semibold text-[clamp(2.5rem,5.5vw,4.5rem)] leading-[0.95] tracking-[-0.035em]" id="page-title">
            {title}
          </h1>
          {aside && <div className="max-w-2xl text-lg text-muted-foreground leading-snug">{lede}</div>}
        </div>
        <div className="flex flex-col gap-5 lg:col-span-4 lg:pb-1">
          {aside ?? <div className="max-w-md text-lg text-muted-foreground leading-snug">{lede}</div>}
          {actions && <div className="flex flex-wrap gap-2.5">{actions}</div>}
          {tags.length > 0 && <p className="font-mono text-muted-foreground text-xs">{tags.join(' · ')}</p>}
        </div>
      </div>
    </section>
  );
}

export function SectionHead({ id, title, children }: { id: string; title: string; children?: ReactNode }) {
  return (
    <div className="grid gap-4 border-b px-4 pt-14 pb-8 sm:px-8 sm:pt-20 lg:grid-cols-12 lg:gap-10">
      <h2 className="text-balance font-semibold text-3xl tracking-[-0.03em] sm:text-[2.75rem] sm:leading-[1.05] lg:col-span-6" id={id}>
        {title}
      </h2>
      {children && <div className="max-w-xl text-lg text-muted-foreground leading-snug lg:col-span-5 lg:col-start-8 lg:pt-1.5 [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-foreground">{children}</div>}
    </div>
  );
}

/** A section of the sheet with its own head. */
export function Section({ id, title, intro, children, className }: { id: string; title: string; intro?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section aria-labelledby={id} className={cn('scroll-mt-14 border-b', className)}>
      <SectionHead id={id} title={title}>
        {intro}
      </SectionHead>
      {children}
    </section>
  );
}

/** The drafting-grid stage a live demo sits on, with a mono caption. */
export function DemoStage({ caption, children }: { caption: ReactNode; children: ReactNode }) {
  return (
    <section aria-label="Live demo" className="drafting-grid border-b">
      <div className="flex flex-col gap-3 px-4 py-6 sm:px-8 sm:py-10">
        <p className="font-mono text-muted-foreground text-xs">{caption}</p>
        {children}
      </div>
    </section>
  );
}

/** Body copy: comfortable measure, links underlined, inline code in mono. */
export function Prose({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'flex max-w-3xl flex-col gap-4 text-[1.0625rem] leading-relaxed [&_a]:underline [&_a]:underline-offset-2 [&_a:hover]:text-muted-foreground [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.85em] [&_h3]:mt-4 [&_h3]:font-semibold [&_h3]:text-xl [&_h3]:tracking-[-0.01em] [&_li]:ms-5 [&_li]:list-disc [&_li]:ps-1 [&_ol>li]:list-decimal [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A grid of linked cells in the landing page's "yard" style: name, mono tag, one line. */
export function LinkGrid({ items, columns = 4 }: { items: { name: string; tag?: string; summary: ReactNode; href: string }[]; columns?: 2 | 3 | 4 }) {
  const cols = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 xl:grid-cols-4' }[columns];
  return (
    // Every cell draws its right and bottom rule; the wrapper clips the outer ones.
    <div className="overflow-hidden">
    <ul className={cn('-me-px -mb-px grid grid-cols-1', cols)}>
      {items.map((item) => (
        <li className="border-r border-b" key={item.href + item.name}>
          <Link className="flex h-full flex-col gap-2.5 px-4 py-7 transition-colors hover:bg-muted/40 sm:px-8" href={item.href}>
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-medium text-lg">{item.name}</span>
              {item.tag && <span className="shrink-0 font-mono text-muted-foreground text-xs">{item.tag}</span>}
            </div>
            <p className="text-muted-foreground leading-snug">{item.summary}</p>
          </Link>
        </li>
      ))}
    </ul>
    </div>
  );
}

/** Questions and answers, all visible (no accordion), marked with data-faq for structured data. */
export function FaqSection({ items, title = 'Questions people ask' }: { items: readonly FaqItem[]; title?: string }) {
  return (
    <section aria-labelledby="faq-title" className="scroll-mt-14 overflow-hidden border-b" data-faq id="faq">
      <FaqJsonLd faq={items} />
      <SectionHead id="faq-title" title={title} />
      <dl className="-me-px -mb-px grid grid-cols-1 lg:grid-cols-2">
        {items.map((item) => (
          <div className="flex flex-col gap-2.5 border-r border-b px-4 py-7 sm:px-8" key={item.q}>
            <dt className="font-medium text-lg leading-snug">{item.q}</dt>
            <dd className="text-muted-foreground leading-relaxed">
              {item.a}
              {item.links && (
                <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                  {item.links.map((l) => (
                    <Link className="inline-flex items-center gap-1 text-foreground text-sm underline-offset-2 hover:underline" href={l.href} key={l.href}>
                      {l.label} <ArrowRightIcon className="size-3.5" />
                    </Link>
                  ))}
                </span>
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/** A row of "next" links closing a page. */
export function EndLinks({ items }: { items: { href: string; label: string }[] }) {
  return (
    <nav aria-label="More" className="flex flex-wrap gap-x-6 gap-y-2 px-4 py-6 text-sm sm:px-8">
      {items.map((item) => (
        <Link className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground" href={item.href} key={item.href}>
          {item.label}
          <ArrowRightIcon className="size-3.5" />
        </Link>
      ))}
    </nav>
  );
}
