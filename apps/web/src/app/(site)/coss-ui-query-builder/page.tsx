import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import Link from 'next/link';
import type { FaqItem } from '@/components/seo/blocks';
import { KitPage } from '@/components/seo/kit-page';

export const metadata: Metadata = pageMetadata({
  title: 'coss ui Query Builder: Base UI components, MIT',
  description:
    "qnot's reference query builder, made of coss ui components on Base UI: functions, list conditions, field references, locks. MIT, one shadcn command.",
  path: '/coss-ui-query-builder',
});

export const faq: FaqItem[] = [
  {
    q: 'What is coss ui?',
    a: "coss ui is coss.com's component library, built on Base UI and distributed through a shadcn registry. It is the library this site is made of.",
  },
  {
    q: 'Is it free?',
    a: 'Yes. The builder is MIT licensed, with no API key and no account. The coss ui components it uses come from coss\'s own registry under coss\'s terms.',
  },
  {
    q: 'How is it different from the other kits?',
    a: "It's the reference builder, the one the playground uses. Feature for feature it matches @qnot/react's default UI: grouped object fields, field references and functions on either side of a rule, list conditions (\"at least 2 orders where…\"), locks, and controls disabled by the store's permissions.",
  },
  {
    q: 'How do I set up a project for it?',
    a: 'Run shadcn init with the coss style (npx shadcn@latest init @coss/style), then shadcn add the builder. The coss ui components it uses come from coss\'s registry into components/ui.',
  },
  {
    q: 'Can I use it in a shadcn/ui project?',
    a: 'Only if the project uses Base UI. The coss builder and the shadcn/ui builder both install into components/ui with the same component names, so pick one per project. Radix-based shadcn/ui projects should use the shadcn/ui builder.',
    links: [{ href: '/shadcn-query-builder', label: 'shadcn/ui builder' }],
  },
  {
    q: 'Can the same query run on the server?',
    a: 'Yes. Share fields.ts with your API, validate the incoming query with validateQuery, then encode it to SQL with bound parameters or a MongoDB filter, or filter rows in memory with compile.',
    links: [{ href: '/docs/guides/server', label: 'Server usage' }],
  },
];

export default function Page() {
  return (
    <KitPage
      path="/coss-ui-query-builder"
      component="CossQueryBuilder"
      facts={[
        ['license', 'MIT'],
        ['built on', 'Base UI'],
        ['features', 'Full RAQB parity'],
        ['install', 'One shadcn add'],
      ]}
      faq={faq}
      importLine="import { CossQueryBuilder } from '@/components/qnot/query-builder';"
      kit="coss"
      lede="qnot's reference builder, made of coss ui components on Base UI. Functions, list conditions, field references and locks, as source you own."
      name="coss ui"
      notes={
        <>
          <p>
            Two files: <code>query-builder.tsx</code> renders groups and rules, <code>controls.tsx</code> holds the editors (selects, comboboxes with async search, list
            inputs, function editors). Nothing touches the store except through <Link href="/docs/reference/hooks">@qnot/react's hooks</Link>, so the pair doubles as the recipe
            for building your own UI.
          </p>
          <p>
            This is the builder the <Link href="/playground">playground</Link> and the <Link href="/examples">examples</Link> use.
          </p>
        </>
      }
      setup={
        <p>
          For a coss ui project (<code>npx shadcn@latest init @coss/style</code>). The coss components it uses come from coss's registry into <code>components/ui</code>.
        </p>
      }
      tags={['MIT', 'Base UI', 'Tailwind v4', 'React 18+']}
      title="coss ui query builder"
    />
  );
}
