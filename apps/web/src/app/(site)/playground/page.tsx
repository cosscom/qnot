import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Metadata } from 'next';
import { codeToHtml } from 'shiki';
import { registryUrl } from '@/lib/registry';
import { ClientOnly } from '@/components/client-only';
import { PlaygroundPage } from '@/playground/Playground';

export const metadata: Metadata = {
  title: 'Playground',
  description: 'Build a query, watch it export to every format, filter sample data, and switch frameworks on one store.',
};

// The playground's schema file, shown in its Code tab exactly as it runs (read at build time).
const SCHEMA = join(process.cwd(), 'src', 'playground', 'schema.ts');

export default async function Page() {
  const code = readFileSync(SCHEMA, 'utf8');
  const html = await codeToHtml(code, { lang: 'typescript', themes: { light: 'github-light', dark: 'github-dark' }, defaultColor: false });
  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1">
      <section className="border-b">
        <div className="flex flex-col gap-4 px-4 pt-10 pb-8 sm:px-8 lg:grid lg:grid-cols-12 lg:items-end lg:gap-10">
          <h1 className="text-balance font-semibold text-[clamp(2.25rem,4.5vw,3.5rem)] leading-[0.95] tracking-[-0.03em] lg:col-span-7">Playground</h1>
          <p className="max-w-xl text-lg text-muted-foreground leading-snug lg:col-span-5 lg:pb-1">
            Every RAQB feature on one schema: structs, lists, tree options, async search, functions, a custom operator. Export to every format, filter 1,000 nested rows, and switch frameworks on the same store.
          </p>
        </div>
      </section>
      <section className="drafting-grid border-b">
        <ClientOnly className="p-4 sm:p-6" minHeight={900}>
          <PlaygroundPage cossUrl={registryUrl('query-builder')} schema={{ code, html }} />
        </ClientOnly>
      </section>
    </main>
  );
}
