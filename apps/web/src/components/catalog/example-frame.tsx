import Link from 'next/link';
import type { ReactNode } from 'react';
import { ArrowLeftIcon } from 'lucide-react';

/**
 * An example's page: a ruled head (back link, title, what it's for, tags), the live demo on a
 * drafting grid, then notes and code. The examples port fills `demo` with a client component and
 * `code` with <CodePanel>s.
 */
export function ExampleFrame({
  title,
  description,
  tags = [],
  demo,
  code,
  aside,
}: {
  title: string;
  description: ReactNode;
  tags?: string[];
  /** The live example (a client component). */
  demo: ReactNode;
  /** Code panels, notes. */
  code?: ReactNode;
  /** Right column of the head (stats, links). */
  aside?: ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1">
      <section className="border-b">
        <div className="flex flex-col gap-6 px-4 pt-10 pb-8 sm:px-8 lg:grid lg:grid-cols-12 lg:items-end lg:gap-10">
          <div className="flex flex-col gap-4 lg:col-span-8">
            <Link className="inline-flex w-fit items-center gap-1.5 font-mono text-muted-foreground text-xs hover:text-foreground" href="/examples">
              <ArrowLeftIcon className="size-3.5" /> examples
            </Link>
            <h1 className="text-balance font-semibold text-[clamp(2.25rem,4.5vw,3.5rem)] leading-[0.95] tracking-[-0.03em]">{title}</h1>
            <div className="max-w-2xl text-lg text-muted-foreground leading-snug">{description}</div>
            {tags.length > 0 && (
              <ul className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-muted-foreground text-xs">
                {tags.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}
          </div>
          {aside && <div className="lg:col-span-4 lg:pb-1">{aside}</div>}
        </div>
      </section>
      <section className="drafting-grid border-b px-4 py-8 sm:px-8 sm:py-12">{demo}</section>
      {code && <section className="flex flex-col gap-6 px-4 py-10 sm:px-8">{code}</section>}
    </main>
  );
}
