import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { RegistrySource } from '@/components/catalog/registry-source';
import { ClientOnly } from '@/components/client-only';
import { KitsPreview, type KitId } from '@/kits/preview';
import { registryItem } from '@/lib/registry';

export const metadata: Metadata = {
  title: 'UI kits',
  description: 'The same query builder in coss ui, shadcn/ui, MUI and plain HTML, all editing one store.',
};

/** The registry item behind each kit in the switcher. */
const ITEMS: Record<KitId, string> = {
  coss: 'query-builder',
  shadcn: 'query-builder-shadcn',
  mui: 'query-builder-mui',
  headless: 'query-builder-headless',
};

/** shadcn/ui components an item pulls from the official registry (bare names; URLs are other registries). */
const shadcnComponents = (item: string) => (registryItem(item)?.registryDependencies ?? []).filter((d) => !d.includes('://'));

function setup(kit: KitId): ReactNode {
  switch (kit) {
    case 'coss':
      return (
        <p>
          For a coss ui project (<code>pnpm dlx shadcn@latest init @coss/style</code>). The coss components it uses come from coss's registry into <code>components/ui</code>.
        </p>
      );
    case 'shadcn':
      return (
        <p>
          For a <strong className="font-medium text-foreground">Radix-based</strong> shadcn/ui project (<code>pnpm dlx shadcn@latest init --base radix</code>); Base UI styles
          (<code>base-*</code> in <code>components.json</code>) aren't supported, and the coss ui builder is the Base UI option. Adds these shadcn/ui components in your
          project's style to <code>components/ui</code> if they're missing:{' '}
          {shadcnComponents(ITEMS.shadcn).map((c, i) => (
            <span key={c}>
              {i > 0 && ', '}
              <code>{c}</code>
            </span>
          ))}
          . coss ui installs into the same folder: pick one style per project.
        </p>
      );
    case 'mui':
      return (
        <p>
          Installs <code>@mui/material</code>, <code>@mui/icons-material</code> and Emotion. The builder wraps itself in its own <code>ThemeProvider</code> (light or dark from the{' '}
          <code>dark</code> class on <code>&lt;html&gt;</code>), so it needs neither your theme nor <code>CssBaseline</code>; edit <code>themeFor</code> in the file to match your
          app. With the App Router and MUI elsewhere on the page, keep your usual <code>AppRouterCacheProvider</code>.
        </p>
      );
    case 'headless':
      return <p>No setup: plain HTML elements styled with Tailwind classes, the starting point for your own design system.</p>;
  }
}

export default function Page() {
  const code = Object.fromEntries(
    (Object.keys(ITEMS) as KitId[]).map((kit) => [
      kit,
      <RegistrySource
        intro={
          <p>
            One command installs this kit's builder and the kit-agnostic core it shares with the others, into <code className="font-mono text-sm">components/qnot</code>. MIT, yours
            to change. See{' '}
            <Link className="underline underline-offset-2 hover:text-foreground" href="/docs/guides/shadcn">
              Install with shadcn
            </Link>
            .
          </p>
        }
        key={kit}
        name={ITEMS[kit]}
        setup={setup(kit)}
        title="Add this kit"
      />,
    ]),
  ) as Record<KitId, ReactNode>;
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
      <ClientOnly minHeight={700}>
        <KitsPreview code={code} />
      </ClientOnly>
    </main>
  );
}
