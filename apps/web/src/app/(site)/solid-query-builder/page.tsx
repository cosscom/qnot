import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import Link from 'next/link';
import type { FaqItem } from '@/components/seo/blocks';
import { FrameworkPage } from '@/components/seo/framework-page';

export const metadata: Metadata = pageMetadata({
  title: 'Solid Query Builder: open-source, typed, fast',
  description:
    'An MIT-licensed query builder for SolidJS with fine-grained primitives, drag and drop, undo and validation. Export to SQL, MongoDB and JsonLogic.',
  path: '/solid-query-builder',
});

export const faq: FaqItem[] = [
  {
    q: 'Is it free?',
    a: 'Yes. @qnot/solid and @qnot/core are MIT licensed. No license key, no paid tier.',
  },
  {
    q: 'Does it work with SolidStart?',
    a: "Yes. The package ships source through the solid export condition, which vite-plugin-solid (and so SolidStart) compiles for the client and the server. The default builder renders with Solid's renderToString (we checked it), and server functions can import the same fields.ts to validate the query and turn it into SQL.",
    links: [{ href: '/docs/guides/server', label: 'Server usage' }],
  },
  {
    q: 'Is it fine-grained?',
    a: 'Yes. useRule(id) returns separate accessors for the rule, its field, operator, value, issues and permissions, so an editor that reads only value() re-runs only when the value changes.',
  },
  {
    q: 'Can I use it next to React in one Vite app?',
    a: 'Yes, with the usual care: limit each JSX plugin to its own files with include / exclude. The qnot store is plain TypeScript and can be shared between the two.',
    links: [{ href: '/docs/guides/solid', label: 'Solid guide' }],
  },
  {
    q: 'Can I write my own components?',
    a: 'Yes. Pass components to replace single pieces of the default builder, or build your own from useGroup, useRule, useNode and the drag primitives (useDragHandle, useDropTarget, useGroupDropZone).',
  },
  {
    q: 'Which export formats are there?',
    a: 'SQL in five dialects with bound parameters, MongoDB, JsonLogic, Elasticsearch, SpEL and plain English, plus two-way JSON for react-querybuilder, react-awesome-query-builder and jQuery QueryBuilder. Each codec is its own import, so you bundle only what you use.',
    links: [{ href: '/docs/concepts/formats', label: 'Formats' }],
  },
];

const sample = `import '@qnot/core/styles.css';
import { encode } from '@qnot/core';
import { sqlFormat } from '@qnot/core/formats/sql';
import { QueryBuilder } from '@qnot/solid';
import { createMemo, createSignal } from 'solid-js';
import { fields, initial } from './fields';

const pg = sqlFormat({ dialect: 'postgres', params: 'numbered' });

export function Filters() {
  const [query, setQuery] = createSignal(initial);
  // { sql: 'age >= $1 AND plan IN ($2, $3) AND …', params: [21, 'pro', 'team', …] }
  const where = createMemo(() => encode(pg, query(), fields));
  return (
    <>
      <QueryBuilder fields={fields} value={query()} onChange={setQuery} showLock />
      <pre>{where().sql}</pre>
    </>
  );
}`;

export default function Page() {
  return (
    <FrameworkPage
      path="/solid-query-builder"
      api={
        <>
          <p>
            For more control, create the store with <code>useQueryStore</code>, share it with <code>&lt;QueryProvider&gt;</code>, and read it with <code>useQuery</code>,{' '}
            <code>useHistory</code> or <code>useIsValid</code>. Each primitive subscribes to one node of the store, which suits Solid's fine-grained updates.
          </p>
          <p>
            The default builder takes <code>components</code>, <code>labels</code> and <code>class</code>. See the <Link href="/docs/guides/solid">Solid guide</Link>.
          </p>
        </>
      }
      compare={{
        ids: ['rqb', 'jqqb', 'syncfusion'],
        against: 'qnot-dom',
        intro: (
          <>
            Without a Solid-native builder, the options are a framework-free library or one embedded from another framework. Below, those against qnot's framework-free
            build on <Link href="/benchmarks">the same 1,000-rule tree</Link>. The Solid binding has <Link href="/benchmarks">its own numbers</Link>.
          </>
        ),
      }}
      dndHref="/docs/guides/solid"
      docsHref="/docs/guides/solid"
      faq={faq}
      framework="solid"
      lede="An open-source query builder for SolidJS. Fine-grained primitives over one store, with undo, drag and drop, validation and export to SQL, MongoDB and JsonLogic."
      name="Solid"
      pkg="@qnot/solid"
      sample={{ file: 'Filters.tsx', lang: 'tsx', code: sample }}
      tags={['MIT', 'SolidJS', 'fine-grained', 'TypeScript']}
      title="Solid query builder"
    />
  );
}
