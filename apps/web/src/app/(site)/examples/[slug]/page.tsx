import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CodePanel, ExampleFrame } from '@/components/catalog';
import { ClientOnly } from '@/components/client-only';
import { EXAMPLES, exampleBySlug } from '@/examples/catalog';
import { DEMOS } from '@/examples/demos';
import { cn } from '@/lib/utils';

export const generateStaticParams = () => EXAMPLES.map((e) => ({ slug: e.slug }));
export const dynamicParams = false;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const e = exampleBySlug((await params).slug);
  return e ? { title: e.title, description: e.blurb } : {};
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const example = exampleBySlug(slug);
  const Demo = DEMOS[slug];
  if (!example || !Demo) notFound();
  const index = EXAMPLES.indexOf(example);
  const next = EXAMPLES[(index + 1) % EXAMPLES.length]!;
  return (
    <ExampleFrame
      title={example.title}
      description={example.description}
      tags={[example.category.toLowerCase(), ...example.tags]}
      aside={
        <a className="group flex flex-col gap-1 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/40" href={`/examples/${next.slug}`}>
          <span className="font-mono text-muted-foreground text-xs">next example →</span>
          <span className="font-medium">{next.title}</span>
          <span className="text-muted-foreground text-sm leading-snug">{next.blurb}</span>
        </a>
      }
      demo={
        <div className={cn('mx-auto w-full max-w-[1280px] min-w-0', !example.bleed && 'rounded-2xl border bg-card p-4 shadow-xs/5 sm:p-6')} data-example={slug}>
          <ClientOnly minHeight={example.bleed ? 900 : 480}>
            <Demo />
          </ClientOnly>
        </div>
      }
      code={<CodePanel code={example.code} title={`${slug}.tsx`} />}
    />
  );
}
