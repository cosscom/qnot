import { BookOpenIcon, PlayIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CodePanel } from '@/components/catalog/code-panel';
import { ClientOnly } from '@/components/client-only';
import { CopyLine } from '@/components/site/copy-line';
import { Button } from '@/components/ui/button';
import { withBrand } from '@/lib/site';
import { DemoStage, EndLinks, FaqSection, LinkGrid, PageHero, Section, Sheet, type FaqItem } from './blocks';
import { FrameworkDemo, type DemoFramework } from './framework-demo';
import { CompareLinks, COMPARES, demoFieldsSource } from './shared';

export const FRAMEWORK_PAGES: { framework: DemoFramework; name: string; href: string }[] = [
  { framework: 'react', name: 'React', href: '/react-query-builder' },
  { framework: 'vue', name: 'Vue', href: '/vue-query-builder' },
  { framework: 'svelte', name: 'Svelte', href: '/svelte-query-builder' },
  { framework: 'solid', name: 'Solid', href: '/solid-query-builder' },
  { framework: 'vanilla', name: 'JavaScript', href: '/javascript-query-builder' },
];

export interface FrameworkPageProps {
  framework: DemoFramework;
  /** "Vue", "Svelte"… */
  name: string;
  /** The binding's package, e.g. "@qnot/vue" (branded when shown). */
  pkg: string;
  title: string;
  lede: ReactNode;
  tags: string[];
  /** The component file of the minimal sample; fields.ts is shown next to it. */
  sample: { file: string; lang: string; code: string };
  /** A paragraph or two under the sample: what the binding gives you beyond the default builder. */
  api: ReactNode;
  docsHref: string;
  dndHref: string;
  compare: { intro: ReactNode; ids: (keyof typeof COMPARES)[]; against?: 'qnot' | 'qnot-dom' };
  faq: readonly FaqItem[];
}

export function FrameworkPage(props: FrameworkPageProps) {
  const pkg = withBrand(props.pkg);
  const install = withBrand(`pnpm add @qnot/core ${props.pkg}`);
  const features = [
    { name: 'Typed schema', tag: 'defineFields · QueryOf', summary: 'Declare fields once. Rule values narrow by field and operator, and validated queries come back typed.', href: '/docs/concepts/schema' },
    { name: 'Export anywhere', tag: 'SQL · Mongo · JsonLogic', summary: 'Parameterized SQL in five dialects, MongoDB, JsonLogic, Elasticsearch, SpEL and plain English.', href: '/docs/concepts/formats' },
    { name: 'Validation', tag: 'issues', summary: 'Per-rule issues from the schema: required, min/max, patterns, options and your own checks.', href: '/docs/concepts/validation' },
    { name: 'Undo and redo', tag: 'history', summary: 'Every edit is a step, typing merges into one. The demo above has the buttons wired up.', href: '/docs/reference/store#history' },
    { name: 'Drag and drop', tag: 'dnd', summary: `Move rules and groups anywhere. The ${props.name} binding ships the drag handle and drop target helpers.`, href: props.dndHref },
    { name: 'Any language', tag: 'labels · messages', summary: 'Every UI string and validation message is an override away. No i18n library required.', href: '/docs/guides/i18n' },
    { name: 'Same query on the server', tag: 'validate · compile', summary: 'Share fields.ts with your API. Validate the query, then run it as bound SQL or filter rows in memory.', href: '/docs/guides/server' },
    { name: 'Fast at 1,000 rules', tag: 'per-node subscriptions', summary: 'Editing one rule updates one rule. A keystroke costs the same at ten rules or a thousand.', href: '/#benchmarks' },
  ];
  return (
    <Sheet>
      <PageHero
        actions={
          <>
            <Button className="px-4" render={<Link href={props.docsHref} />}>
              <BookOpenIcon />
              {props.name} guide
            </Button>
            <Button className="px-4" render={<Link href="/playground" />} variant="outline">
              <PlayIcon />
              Playground
            </Button>
          </>
        }
        lede={props.lede}
        tags={props.tags}
        title={props.title}
      />
      <DemoStage caption={`${pkg}, default builder, live on this page. Edit a rule and watch the exports.`}>
        <ClientOnly minHeight={420}>
          <FrameworkDemo framework={props.framework} label={pkg} />
        </ClientOnly>
      </DemoStage>
      <section aria-label="Install" className="border-b bg-background">
        <CopyLine command={install} label="install" />
      </section>
      <Section
        id="code-title"
        intro={
          <>
            The fields you can query, and the component that edits them. It's the code behind the demo above, minus the export tabs.
          </>
        }
        title={`A ${props.name} query builder in two files.`}
      >
        <div className="grid grid-cols-1 gap-4 px-4 py-8 sm:px-8 lg:grid-cols-2">
          <CodePanel code={demoFieldsSource()} lang="ts" title="fields.ts" />
          <CodePanel code={withBrand(props.sample.code)} lang={props.sample.lang} title={props.sample.file} />
        </div>
        <div className="border-t px-4 py-8 text-muted-foreground leading-relaxed sm:px-8 [&_a]:text-foreground [&_a]:underline [&_a]:underline-offset-2 [&_code]:font-mono [&_code]:text-[0.9em] [&_code]:text-foreground [&_p+p]:mt-3">
          <div className="max-w-3xl">{props.api}</div>
        </div>
      </Section>
      <Section id="features-title" intro="Everything below works in every binding, because it lives in the store, not the components." title="What you get.">
        <LinkGrid items={features} />
      </Section>
      <Section id="compare-title" intro={props.compare.intro} title="How it compares.">
        <CompareLinks against={props.compare.against} ids={props.compare.ids} />
      </Section>
      <FaqSection items={props.faq} />
      <EndLinks
        items={[
          { href: props.docsHref, label: `${props.name} guide` },
          ...FRAMEWORK_PAGES.filter((f) => f.framework !== props.framework).map((f) => ({ href: f.href, label: `${f.name} query builder` })),
          { href: '/kits', label: 'UI kits' },
          { href: '/compare', label: 'All comparisons' },
        ]}
      />
    </Sheet>
  );
}
