import type { Metadata } from 'next';
import { ClientOnly } from '@/components/client-only';
import { KitsPreview } from '@/kits/preview';

export const metadata: Metadata = {
  title: 'UI kits',
  description: 'The same query builder in coss ui, shadcn/ui, MUI, Mantine and plain HTML, all editing one store.',
};

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1">
      <section className="border-b">
        <div className="flex flex-col gap-4 px-4 pt-10 pb-8 sm:px-8 lg:grid lg:grid-cols-12 lg:items-end lg:gap-10">
          <h1 className="text-balance font-semibold text-[clamp(2.25rem,4.5vw,3.5rem)] leading-[0.95] tracking-[-0.03em] lg:col-span-7">Any UI kit</h1>
          <p className="max-w-xl text-lg text-muted-foreground leading-snug lg:col-span-5 lg:pb-1">
            One headless builder, five looks. Every kit below is the same hooks and the same store; only the controls change. Switch kits and keep editing.
          </p>
        </div>
      </section>
      <section className="drafting-grid border-b">
        <ClientOnly className="p-4 sm:p-6" minHeight={700}>
          <KitsPreview />
        </ClientOnly>
      </section>
    </main>
  );
}
