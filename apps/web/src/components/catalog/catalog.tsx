import Link from 'next/link';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/*
 * The catalog of coss.com/ui: a card per entry, its title and one line on top, and under it a
 * darker inset holding an abstract line drawing of the thing (see ./drawing.tsx).
 */

export function CatalogGrid({ className, children }: { className?: string; children: ReactNode }) {
  return <ul className={cn('grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4', className)}>{children}</ul>;
}

export function CatalogCard({
  href,
  title,
  description,
  tag,
  children,
  className,
}: {
  href?: string;
  title: string;
  description: string;
  /** A short mono label in the corner (category, "new"…). */
  tag?: string;
  /** The drawing, built from ./drawing.tsx's pieces. */
  children: ReactNode;
  className?: string;
}) {
  const body = (
    <>
      <div className="flex flex-col gap-1 px-6 pt-5 pb-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-heading font-semibold text-[1.0625rem] tracking-[-0.01em]">{title}</h3>
          {tag && <span className="shrink-0 font-mono text-[0.6875rem] text-muted-foreground">{tag}</span>}
        </div>
        <p className="line-clamp-2 text-muted-foreground text-sm leading-snug">{description}</p>
      </div>
      <div className="relative mx-1 mb-1 flex min-h-56 flex-1 items-center justify-center overflow-hidden rounded-[calc(var(--radius-2xl)-4px)] border bg-sidebar px-6 py-8 transition-colors duration-300 group-hover:bg-muted/60 dark:bg-background/60">
        <div className="pointer-events-none w-full max-w-64 transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] group-hover:-translate-y-1">{children}</div>
      </div>
    </>
  );
  const shell = 'group flex h-full flex-col overflow-hidden rounded-2xl border bg-card shadow-xs/5 transition-shadow hover:shadow-md/5';
  return (
    <li className={className}>
      {href ? (
        <Link className={shell} href={href}>
          {body}
        </Link>
      ) : (
        <div className={shell}>{body}</div>
      )}
    </li>
  );
}
