import { BookOpenIcon, LayoutGridIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CodePanel } from '@/components/catalog/code-panel';
import { RegistrySource } from '@/components/catalog/registry-source';
import { ClientOnly } from '@/components/client-only';
import { Button } from '@/components/ui/button';
import type { KitId } from '@/kits/preview';
import { registryItem } from '@/lib/registry';
import { withBrand } from '@/lib/site';
import { DemoStage, EndLinks, FaqSection, LinkGrid, PageHero, Section, Sheet, type FaqItem } from './blocks';
import { KitDemo } from './kit-demo';
import { demoFieldsSource } from './shared';

export const KIT_PAGES: { kit: KitId; name: string; href: string; item: string }[] = [
  { kit: 'shadcn', name: 'shadcn/ui', href: '/shadcn-query-builder', item: 'query-builder-shadcn' },
  { kit: 'coss', name: 'coss ui', href: '/coss-ui-query-builder', item: 'query-builder' },
  { kit: 'mui', name: 'MUI', href: '/mui-query-builder', item: 'query-builder-mui' },
  { kit: 'headless', name: 'Headless', href: '/headless-query-builder', item: 'query-builder-headless' },
];

/** shadcn/ui components an item pulls from the official registry (bare names; URLs are other registries). */
export const shadcnComponents = (item: string) => (registryItem(item)?.registryDependencies ?? []).filter((d) => !d.includes('://'));

export interface KitPageProps {
  kit: KitId;
  /** "shadcn/ui", "MUI"… */
  name: string;
  title: string;
  lede: ReactNode;
  tags: string[];
  /** Four short facts under the hero: [label, value]. */
  facts: [string, string][];
  /** Setup notes shown under the install command. */
  setup: ReactNode;
  /** Where the installed builder lives and what it exports. */
  importLine: string;
  component: string;
  /** Paragraphs about the installed code. */
  notes: ReactNode;
  faq: readonly FaqItem[];
}

export function KitPage(props: KitPageProps) {
  const page = KIT_PAGES.find((k) => k.kit === props.kit)!;
  const usage = `'use client';
import type { QueryOf } from '@qnot/core';
import { useQueryStore } from '@qnot/react';
${props.importLine}
import { fields, initial } from './fields';

export function Filters({ onChange }: { onChange: (query: QueryOf<typeof fields>) => void }) {
  // Every edit hands you the query as JSON typed by your fields: save it, or encode it to SQL.
  const store = useQueryStore({ fields, initial, onChange });
  return <${props.component} store={store} showLock />;
}`;
  const features = [
    { name: 'Source you own', tag: 'shadcn add', summary: 'The builder lands in components/qnot as plain TSX. Change any control; nothing is hidden in a package.', href: '/docs/guides/shadcn' },
    { name: 'Typed schema', tag: 'defineFields', summary: 'Fields declare their editors: text, number, enum, multi-select, dates, booleans, lists and objects.', href: '/docs/concepts/schema' },
    { name: 'Export anywhere', tag: 'SQL · Mongo · JsonLogic', summary: 'The store holds plain JSON. Encode it to parameterized SQL, MongoDB, JsonLogic, Elasticsearch or SpEL.', href: '/docs/concepts/formats' },
    { name: 'Undo, drag and drop', tag: 'history · dnd', summary: 'Every edit is a step. Drag rules and groups by the handle; locks and limits are respected.', href: '/docs/reference/store#history' },
  ];
  return (
    <Sheet>
      <PageHero
        actions={
          <>
            <Button className="px-4" render={<Link href="#install" />}>
              Install
            </Button>
            <Button className="px-4" render={<Link href="/docs/guides/shadcn" />} variant="outline">
              <BookOpenIcon />
              Docs
            </Button>
            <Button className="px-4" render={<Link href={`/kits?kit=${props.kit}`} />} variant="ghost">
              <LayoutGridIcon />
              All kits
            </Button>
          </>
        }
        lede={props.lede}
        tags={props.tags}
        title={props.title}
      />
      <section aria-label="At a glance" className="grid grid-cols-2 border-b lg:grid-cols-4">
        {props.facts.map(([label, value], i) => (
          <div className={`flex flex-col gap-1 px-4 py-5 sm:px-8 ${i % 2 === 0 ? 'border-r' : ''} ${i < 2 ? 'border-b lg:border-b-0' : ''} ${i === 1 ? 'lg:border-r' : ''}`} key={label}>
            <span className="font-mono text-muted-foreground text-xs">{label}</span>
            <span className="font-medium text-lg">{value}</span>
          </div>
        ))}
      </section>
      <DemoStage caption={`The ${props.name} builder that shadcn add installs, live on this page. Edit a rule and watch the exports.`}>
        <ClientOnly minHeight={420}>
          <KitDemo kit={props.kit} label={withBrand(page.item)} />
        </ClientOnly>
      </DemoStage>
      <section aria-label="Install" className="scroll-mt-14 border-b px-4 py-10 sm:px-8" id="install">
        <RegistrySource
          intro={
            <p>
              One command copies the {props.name} builder{props.kit === 'coss' ? '' : ' and the kit-agnostic core it shares with the other kits'} into{' '}
              <code className="font-mono text-sm">components/qnot</code>, and installs <code className="font-mono text-sm">{withBrand('@qnot/core')}</code> and <code className="font-mono text-sm">{withBrand('@qnot/react')}</code>.
              MIT licensed.
            </p>
          }
          name={page.item}
          setup={props.setup}
          title="Install it"
        />
      </section>
      <Section id="use-title" intro="Describe your fields, create a store, render the builder. The store's onChange hands you the query." title="Use it.">
        <div className="grid grid-cols-1 gap-4 px-4 py-8 sm:px-8 lg:grid-cols-2">
          <CodePanel code={demoFieldsSource()} lang="ts" title="fields.ts" />
          <CodePanel code={withBrand(usage)} lang="tsx" title="Filters.tsx" />
        </div>
        <div className="border-t px-4 py-8 text-muted-foreground leading-relaxed sm:px-8 [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2 [&_code]:font-mono [&_code]:text-[0.9em] [&_code]:text-foreground [&_p+p]:mt-3">
          <div className="max-w-3xl">{props.notes}</div>
        </div>
      </Section>
      <Section id="features-title" intro="The kit is only the controls. Everything else comes from the qnot store underneath." title="What you get.">
        <LinkGrid items={features} />
      </Section>
      <FaqSection items={props.faq} />
      <EndLinks
        items={[
          ...KIT_PAGES.filter((k) => k.kit !== props.kit).map((k) => ({ href: k.href, label: `${k.name} query builder` })),
          { href: '/react-query-builder', label: 'React query builder' },
          { href: '/docs/guides/shadcn', label: 'Install with shadcn' },
          { href: '/compare', label: 'Comparisons' },
        ]}
      />
    </Sheet>
  );
}
