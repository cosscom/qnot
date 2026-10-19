import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import Link from 'next/link';
import type { FaqItem } from '@/components/seo/blocks';
import { FrameworkPage } from '@/components/seo/framework-page';

export const metadata: Metadata = pageMetadata({
  title: 'React Query Builder: open-source, typed, fast',
  description:
    'An MIT-licensed React query builder: typed from your schema to parameterized SQL, MongoDB and JsonLogic, with undo, drag and drop. Stays fast at 1,000 rules.',
  path: '/react-query-builder',
});

export const faq: FaqItem[] = [
  {
    q: 'Is it free?',
    a: 'Yes. qnot is MIT licensed, the core and every binding. There is no paid tier, no license key and no API key.',
  },
  {
    q: 'Does it work with Next.js and server rendering?',
    a: "Yes. Render the builder from a client component ('use client'). It server-renders too: the hooks give React the same snapshot on the server, and node ids are sequential per store, so the server HTML matches the client. Your route handlers can import the same fields.ts to validate and run the query.",
    links: [{ href: '/docs/guides/server', label: 'Server usage' }],
  },
  {
    q: 'Which React versions are supported?',
    a: 'React 18 and later. The hooks are built on useSyncExternalStore.',
  },
  {
    q: 'How is it different from react-querybuilder?',
    a: 'react-querybuilder is older, more widely used, has React Native support and exports to more formats. qnot types rule values by field and operator, runs outside React too, and keeps keystrokes under a millisecond at 1,000 rules where react-querybuilder takes about 57 ms in our benchmark.',
    links: [{ href: '/compare/react-querybuilder', label: 'qnot vs react-querybuilder' }],
  },
  {
    q: 'Can I keep my saved react-querybuilder or RAQB queries?',
    a: "Yes. Give the store format: rqb or format: raqb and value / onChange read and write that library's JSON, so stored queries load as they are and keep being saved in the same shape.",
    links: [{ href: '/docs/guides/migrate-react-querybuilder', label: 'Migration guide' }],
  },
  {
    q: 'Can I use my own components or UI kit?',
    a: 'Yes. Swap any piece of the default builder through the components prop, or build your own from the hooks (useGroup, useRule, useNode). Ready-made builders for coss ui, shadcn/ui and MUI install as source with one shadcn command.',
    links: [
      { href: '/shadcn-query-builder', label: 'shadcn/ui builder' },
      { href: '/docs/guides/custom-ui', label: 'Custom UI guide' },
    ],
  },
];

const sample = `'use client';
import '@qnot/core/styles.css';
import { encode, type QueryOf } from '@qnot/core';
import { sqlFormat } from '@qnot/core/formats/sql';
import { QueryBuilder } from '@qnot/react';
import { useMemo, useState } from 'react';
import { fields, initial } from './fields';

const pg = sqlFormat({ dialect: 'postgres', params: 'numbered' });

export function Filters() {
  const [query, setQuery] = useState<QueryOf<typeof fields>>(initial);
  // { sql: 'age >= $1 AND plan IN ($2, $3) AND …', params: [21, 'pro', 'team', …] }
  const where = useMemo(() => encode(pg, query, fields), [query]);
  return (
    <>
      <QueryBuilder fields={fields} value={query} onChange={setQuery} showLock />
      <pre>{where.sql}</pre>
    </>
  );
}`;

export default function Page() {
  return (
    <FrameworkPage
      path="/react-query-builder"
      api={
        <>
          <p>
            The default <code>&lt;QueryBuilder&gt;</code> is unstyled HTML with a small stylesheet. For more control, create the store with <code>useQueryStore</code>, share it with{' '}
            <code>&lt;QueryProvider&gt;</code>, and read it from anywhere with <code>useQuery</code>, <code>useHistory</code> or <code>useIsValid</code>. Each rule component
            subscribes to its own node through <code>useRule(id)</code>, so a keystroke re-renders one rule, not the tree.
          </p>
          <p>
            Prefer a designed UI? The <Link href="/coss-ui-query-builder">coss ui</Link>, <Link href="/shadcn-query-builder">shadcn/ui</Link> and{' '}
            <Link href="/mui-query-builder">MUI</Link> builders are React components built on these hooks.
          </p>
        </>
      }
      compare={{
        ids: ['rqb', 'raqb'],
        intro: (
          <>
            The two established React options are react-querybuilder and react-awesome-query-builder. Both are good libraries; here is where each one fits, measured
            with <Link href="/#benchmarks">the same 1,000-rule tree</Link>.
          </>
        ),
      }}
      dndHref="/docs/guides/react#drag-and-drop"
      docsHref="/docs/guides/react"
      faq={faq}
      framework="react"
      lede="A typed React query builder. Rules, groups, drag and drop, undo, validation, and export to SQL with bound parameters. Editing one rule re-renders one rule."
      name="React"
      pkg="@qnot/react"
      sample={{ file: 'Filters.tsx', lang: 'tsx', code: sample }}
      tags={['MIT', 'React 18+', 'SSR-safe', 'TypeScript']}
      title="React query builder"
    />
  );
}
