import type { Metadata } from 'next';
import Link from 'next/link';
import type { FaqItem } from '@/components/seo/blocks';
import { FrameworkPage } from '@/components/seo/framework-page';

export const metadata: Metadata = {
  title: 'Svelte Query Builder: open-source, typed, fast',
  description:
    'An MIT-licensed query builder for Svelte 5 with bind:value, rune-friendly helpers, drag and drop, undo and validation. Export to SQL, MongoDB and JsonLogic.',
  alternates: { canonical: '/svelte-query-builder' },
};

export const faq: FaqItem[] = [
  {
    q: 'Is it free?',
    a: 'Yes. @qnot/svelte and @qnot/core are MIT licensed, with no license key, no trial banner and no paid tier.',
  },
  {
    q: 'Which Svelte versions are supported?',
    a: 'Svelte 5. The components use runes, and the reactive helpers are built on createSubscriber from svelte/reactivity.',
  },
  {
    q: 'Does it work with SvelteKit?',
    a: "Yes. The package ships .svelte source through the svelte export condition, which SvelteKit's Vite plugin compiles. The default builder renders on the server (we checked it with svelte/server's render), and your +server.ts or form actions can import the same fields.ts to validate the query and turn it into SQL.",
    links: [{ href: '/docs/guides/server', label: 'Server usage' }],
  },
  {
    q: 'Does it support bind:value?',
    a: 'Yes. QueryBuilder takes value as a bindable prop, plus onchange. You can also pass a store you created and share it with setQueryStore.',
  },
  {
    q: 'Can I write my own components?',
    a: 'Yes. createRule, createGroup, createQuery, createHistory and the drag helpers return objects whose getters subscribe only to what they read. They work in components and in .svelte.ts modules. The default Group, Rule and ValueEditor are exported for reuse.',
    links: [{ href: '/docs/guides/svelte', label: 'Svelte guide' }],
  },
  {
    q: 'Can the same query run on the server?',
    a: 'Yes. The query is plain JSON typed by your schema. On the server, validate it with validateQuery, then encode it to parameterized SQL, a MongoDB filter or JsonLogic, or filter rows in memory with compile.',
    links: [{ href: '/docs/concepts/formats', label: 'Formats' }],
  },
];

const sample = `<script lang="ts">
  import '@qnot/core/styles.css';
  import { encode } from '@qnot/core';
  import { sqlFormat } from '@qnot/core/formats/sql';
  import { QueryBuilder } from '@qnot/svelte';
  import { fields, initial } from './fields';

  const pg = sqlFormat({ dialect: 'postgres', params: 'numbered' });

  let query = $state.raw(initial);
  // { sql: 'age >= $1 AND plan IN ($2, $3) AND …', params: [21, 'pro', 'team', …] }
  const where = $derived(encode(pg, query, fields));
</script>

<QueryBuilder {fields} bind:value={query} showLock />
<pre>{where.sql}</pre>`;

export default function Page() {
  return (
    <FrameworkPage
      api={
        <>
          <p>
            For more control, put a store in context with <code>setQueryStore</code> and read it with <code>getQueryStore</code>. The <code>create*</code> helpers (
            <code>createRule</code>, <code>createGroup</code>, <code>createQuery</code>, <code>createHistory</code>) each subscribe only to the node they read, so editing
            one rule updates one rule.
          </p>
          <p>
            The default builder takes <code>components</code>, <code>labels</code> and <code>class</code>. See the <Link href="/docs/guides/svelte">Svelte guide</Link>.
          </p>
        </>
      }
      compare={{
        ids: ['syncfusion', 'devextreme'],
        against: 'qnot-dom',
        intro: (
          <>
            Most Svelte query builders you'll find come inside commercial component suites. Below, their JavaScript builds against qnot's framework-free build on{' '}
            <Link href="/#benchmarks">the same 1,000-rule tree</Link>. The Svelte binding shares that store but wasn't benchmarked on its own.
          </>
        ),
      }}
      dndHref="/docs/guides/svelte"
      docsHref="/docs/guides/svelte"
      faq={faq}
      framework="svelte"
      lede="An open-source query builder for Svelte 5. bind:value in, typed query out, with undo, drag and drop, validation and export to SQL, MongoDB and JsonLogic."
      name="Svelte"
      pkg="@qnot/svelte"
      sample={{ file: 'Filters.svelte', lang: 'svelte', code: sample }}
      tags={['MIT', 'Svelte 5', 'runes', 'TypeScript']}
      title="Svelte query builder"
    />
  );
}
