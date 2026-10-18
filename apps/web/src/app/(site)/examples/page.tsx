import type { Metadata } from 'next';
import { CatalogCard, CatalogGrid, Sketch } from '@/components/catalog';

export const metadata: Metadata = {
  title: 'Examples',
  description: 'What a query builder is for: routing forms, filter bars, segments, feature flags, alert rules, access policies and more, each built on trawlnet.',
};

// The catalog of coss.com/ui. These three cards are placeholders while apps/playground's
// examples move here; each example draws its own preview from <Sketch> pieces.
export default function Page() {
  return (
    <main className="mx-auto w-full max-w-[1440px] flex-1">
      <section className="border-b">
        <div className="flex flex-col gap-6 px-4 pt-12 pb-10 sm:px-8 sm:pt-16 lg:grid lg:grid-cols-12 lg:items-end lg:gap-10">
          <h1 className="text-balance font-semibold text-[clamp(2.5rem,5.5vw,4.5rem)] leading-[0.92] tracking-[-0.035em] lg:col-span-8">What people build with a query builder.</h1>
          <p className="max-w-md text-lg text-muted-foreground leading-snug lg:col-span-4 lg:pb-2">
            Each example is a working app on the same store: different UI, different output, same typed query underneath.
          </p>
        </div>
      </section>
      <section className="px-4 py-8 sm:px-8 sm:py-10">
        <CatalogGrid>
          <CatalogCard description="Send each form response to the right event, page or teammate." href="/examples" tag="product" title="Cal.com routing forms">
            <Sketch.Panel>
              <Sketch.Row>
                <Sketch.Bar tone="ink" w={4} />
                <Sketch.Segmented active={0} />
                <Sketch.Bar w={14} />
              </Sketch.Row>
              <Sketch.Row>
                <Sketch.Select w={12} />
                <Sketch.Select tone="soft" w={6} />
                <Sketch.Select w={9} />
              </Sketch.Row>
              <Sketch.Divider />
              <Sketch.Row className="justify-between">
                <Sketch.Bar w={10} />
                <Sketch.Toggle on />
              </Sketch.Row>
            </Sketch.Panel>
          </CatalogCard>
          <CatalogCard description="Inline filter chips: the same hooks, a completely different UI." href="/examples" tag="ui" title="Linear-style filter bar">
            <Sketch.Row className="flex-wrap">
              <Sketch.Chip active w={10} />
              <Sketch.Chip w={8} />
              <Sketch.Chip w={12} />
              <Sketch.Button w={6} />
            </Sketch.Row>
            <div className="mt-3">
              <Sketch.Grid accent={1} cols={3} rows={2} />
            </div>
          </CatalogCard>
          <CatalogCard description="One query, exported to Postgres with parameters, MongoDB and JsonLogic." href="/examples" tag="server" title="One query, every backend">
            <Sketch.Code lines={[18, 24, 14, 20]} />
          </CatalogCard>
        </CatalogGrid>
        <p className="mt-8 font-mono text-muted-foreground text-xs">More examples are moving over from the playground.</p>
      </section>
    </main>
  );
}
