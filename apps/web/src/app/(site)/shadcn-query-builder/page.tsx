import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import Link from 'next/link';
import type { FaqItem } from '@/components/seo/blocks';
import { KitPage, shadcnComponents } from '@/components/seo/kit-page';

export const metadata: Metadata = pageMetadata({
  title: 'shadcn/ui Query Builder: free, MIT, one command',
  description:
    'A complete query builder made of shadcn/ui components. Free and MIT licensed, no API key, no account: one npx shadcn add puts the source in your project.',
  path: '/shadcn-query-builder',
});

export const faq: FaqItem[] = [
  {
    q: 'Is it free? Do I need an API key or an account?',
    a: 'It is free and MIT licensed, and there is no API key and no account. The registry is a set of static JSON files on this site; shadcn add downloads them and copies the source into your project. Nothing calls home at runtime.',
  },
  {
    q: 'Which shadcn/ui setups does it support?',
    a: "Radix-based shadcn/ui projects (shadcn init --base radix). Projects using a Base UI style (base-* in components.json) get type errors with this item; use the coss ui builder there, which is built on Base UI.",
    links: [{ href: '/coss-ui-query-builder', label: 'coss ui builder' }],
  },
  {
    q: 'What does the command install?',
    a: 'The builder (components/qnot/kits/shadcn.tsx), the kit-agnostic core it shares with the other kits (components/qnot/kits/shared), the npm packages @qnot/core, @qnot/react and lucide-react, and any of the shadcn/ui components it uses that you do not have yet, in your project\'s style.',
  },
  {
    q: 'Can I change how it looks?',
    a: "Yes. It is your code, built from your own shadcn/ui components, so it follows your theme tokens and you can edit any control. Running shadcn add again asks before overwriting files you've changed.",
  },
  {
    q: 'Does it work with the Next.js App Router?',
    a: "Yes. The builder file is a client component ('use client'). Render it from a client component of your own that creates the store, as in the example above.",
  },
  {
    q: 'Can I use it in the same project as coss ui?',
    a: 'Pick one. The coss ui builder and this one both install their components into components/ui, and the components share names (select, button, tooltip), so mixing them overwrites one with the other.',
  },
];

export default function Page() {
  const components = shadcnComponents('query-builder-shadcn');
  return (
    <KitPage
      path="/shadcn-query-builder"
      component="QueryBuilder"
      facts={[
        ['license', 'MIT'],
        ['price', 'Free'],
        ['API key', 'None'],
        ['install', 'One shadcn add'],
      ]}
      faq={faq}
      importLine="import { QueryBuilder } from '@/components/qnot/kits/shadcn';"
      kit="shadcn"
      lede="A complete query builder made of your shadcn/ui components. Free, MIT, no API key. One command copies the source into your project."
      name="shadcn/ui"
      notes={
        <>
          <p>
            The builder is a Radix-based shadcn/ui <code>Select</code>, <code>Command</code> comboboxes in a <code>Popover</code>, <code>ToggleGroup</code> segments and{' '}
            <code>Tooltip</code>s on top of <Link href="/docs/reference/hooks">@qnot/react's hooks</Link>. The hooks own the state; the file owns the markup, so restyling is
            editing JSX.
          </p>
          <p>
            It works from any store: pass one you create with <code>useQueryStore</code> or <code>createQueryStore</code>, and read the query with the store's{' '}
            <code>onChange</code>, <code>useQuery()</code> or <code>store.getQuery()</code>. To keep saved queries from react-querybuilder, add{' '}
            <code>format: rqb</code> (<Link href="/docs/guides/migrate-react-querybuilder">migration guide</Link>).
          </p>
        </>
      }
      setup={
        <p>
          For a <strong className="font-medium text-foreground">Radix-based</strong> shadcn/ui project (<code>npx shadcn@latest init --base radix</code>). Adds these shadcn/ui
          components in your project's style to <code>components/ui</code> if they're missing:{' '}
          {components.map((c, i) => (
            <span key={c}>
              {i > 0 && ', '}
              <code>{c}</code>
            </span>
          ))}
          .
        </p>
      }
      tags={['MIT', 'no API key', 'Radix', 'Tailwind v4', 'React 18+']}
      title="shadcn/ui query builder"
    />
  );
}
