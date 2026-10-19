import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import Link from 'next/link';
import type { FaqItem } from '@/components/seo/blocks';
import { FrameworkPage } from '@/components/seo/framework-page';

export const metadata: Metadata = pageMetadata({
  title: 'Vue Query Builder: open-source, typed, fast',
  description:
    'An MIT-licensed query builder for Vue 3 with v-model, composables, drag and drop, undo and validation. Export to SQL, MongoDB and JsonLogic. No license key.',
  path: '/vue-query-builder',
});

export const faq: FaqItem[] = [
  {
    q: 'Is it free?',
    a: 'Yes. @qnot/vue and @qnot/core are MIT licensed. There is no license key, no trial banner and no per-developer pricing, which sets it apart from the commercial Vue query builders.',
  },
  {
    q: 'Which Vue versions are supported?',
    a: 'Vue 3.5 and later. The components are written with h(), so the package needs no SFC compiler and works in any Vue 3 build setup.',
  },
  {
    q: 'Does it work with Nuxt?',
    a: "Yes. The default builder renders to HTML with Vue's server renderer (we checked it with renderToString), and node ids are sequential per store, so server and client agree. If you only need it in the browser, wrap it in <ClientOnly>. Server routes can import the same fields.ts to validate the query and turn it into SQL.",
    links: [{ href: '/docs/guides/server', label: 'Server usage' }],
  },
  {
    q: 'Does it support v-model?',
    a: 'Yes. QueryBuilder emits update:modelValue and change, so v-model works. You can also pass a store you created with useQueryStore and share it with provideQueryStore.',
  },
  {
    q: 'Can I build my own UI instead of the default one?',
    a: 'Yes. The composables (useRule, useGroup, useNode, useQuery, useHistory and the drag helpers) return shallowRefs and computeds fed by per-node subscriptions. Pass components to replace single pieces of the default builder, or write your own from scratch.',
    links: [{ href: '/docs/guides/vue', label: 'Vue guide' }],
  },
  {
    q: 'How does it compare with Syncfusion or DevExtreme?',
    a: 'Both are commercial suites with Vue wrappers, many more components and paid support. qnot is one free library focused on the query builder, with typed values and more export formats. In our benchmark its framework-free build renders 1,000 rules faster than the JavaScript builds of both; the Vue binding uses the same store but was not measured on its own.',
    links: [
      { href: '/compare/syncfusion-query-builder', label: 'vs Syncfusion' },
      { href: '/compare/devextreme-filterbuilder', label: 'vs DevExtreme' },
    ],
  },
];

const sample = `<script setup lang="ts">
import '@qnot/core/styles.css';
import { encode } from '@qnot/core';
import { sqlFormat } from '@qnot/core/formats/sql';
import { QueryBuilder } from '@qnot/vue';
import { computed, shallowRef } from 'vue';
import { fields, initial } from './fields';

const pg = sqlFormat({ dialect: 'postgres', params: 'numbered' });

const query = shallowRef(initial);
// { sql: 'age >= $1 AND plan IN ($2, $3) AND …', params: [21, 'pro', 'team', …] }
const where = computed(() => encode(pg, query.value, fields));
</script>

<template>
  <QueryBuilder :fields="fields" v-model="query" show-lock />
  <pre>{{ where.sql }}</pre>
</template>`;

export default function Page() {
  return (
    <FrameworkPage
      path="/vue-query-builder"
      api={
        <>
          <p>
            For more control, create the store with <code>useQueryStore</code> and share it with <code>provideQueryStore</code>. The composables mirror the React hooks:{' '}
            <code>useRule(id)</code>, <code>useGroup(id)</code>, <code>useQuery()</code>, <code>useHistory()</code>, <code>useIsValid()</code>. They return{' '}
            <code>shallowRef</code>s fed by the store's per-node subscriptions rather than deep reactivity, so editing one rule updates only that rule's component.
          </p>
          <p>
            The default builder takes <code>components</code> and <code>labels</code> to swap pieces and strings. See the <Link href="/docs/guides/vue">Vue guide</Link>.
          </p>
        </>
      }
      compare={{
        ids: ['syncfusion', 'devextreme'],
        against: 'qnot-dom',
        intro: (
          <>
            Search for a Vue query builder and you mostly find commercial suites. They are complete and well supported, but you pay per developer. Below, their JavaScript builds
            against qnot's framework-free build on <Link href="/benchmarks">the same 1,000-rule tree</Link>. The Vue binding has{' '}
            <Link href="/benchmarks">its own numbers</Link>.
          </>
        ),
      }}
      dndHref="/docs/guides/vue"
      docsHref="/docs/guides/vue"
      faq={faq}
      framework="vue"
      lede="An open-source query builder for Vue 3. v-model in, typed query out, with undo, drag and drop, validation and export to SQL, MongoDB and JsonLogic."
      name="Vue"
      pkg="@qnot/vue"
      sample={{ file: 'Filters.vue', lang: 'vue', code: sample }}
      tags={['MIT', 'Vue 3.5+', 'v-model', 'TypeScript']}
      title="Vue query builder"
    />
  );
}
