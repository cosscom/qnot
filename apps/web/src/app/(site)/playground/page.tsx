import type { Metadata } from 'next';
import Link from 'next/link';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Playground', description: 'Build a query, watch it export to every format, filter sample data, and switch frameworks on one store.' };

// Placeholder until apps/playground's page and its framework islands move here.
export default function Page() {
  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1">
      <section className="border-b">
        <div className="flex flex-col gap-6 px-4 pt-12 pb-10 sm:px-8 sm:pt-16">
          <h1 className="text-balance font-semibold text-[clamp(2.5rem,5.5vw,4.5rem)] leading-[0.92] tracking-[-0.035em]">Playground</h1>
          <p className="max-w-xl text-lg text-muted-foreground leading-snug">Build a query, watch it export to every format, filter sample data, and switch frameworks on one store. Moving here shortly.</p>
          <Button className="w-fit px-4" render={<Link href="/docs" />} variant="outline">
            Read the docs meanwhile
          </Button>
        </div>
      </section>
      <section className="drafting-grid h-96 border-b" />
    </main>
  );
}
