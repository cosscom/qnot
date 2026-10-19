import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import Link from 'next/link';
import type { FaqItem } from '@/components/seo/blocks';
import { KitPage } from '@/components/seo/kit-page';

export const metadata: Metadata = pageMetadata({
  title: 'Headless Query Builder: build your own UI',
  description:
    'A headless query builder: typed hooks over a fast store, plus a complete plain HTML and Tailwind builder to start from. Swap in your design system. MIT.',
  path: '/headless-query-builder',
});

export const faq: FaqItem[] = [
  {
    q: 'What does headless mean here?',
    a: 'The state, rules, validation, undo and drag and drop live in a store and a set of hooks with no markup of their own. This kit is a complete builder written in plain HTML elements and Tailwind classes on top of them: the smallest working example to replace piece by piece.',
  },
  {
    q: 'Do I need Tailwind?',
    a: 'The installed file is styled with Tailwind classes. Without Tailwind, replace the class strings with your own CSS; the markup is plain <select>, <input>, <button> and <details>.',
  },
  {
    q: 'Can I skip the kit and start from the hooks?',
    a: 'Yes. A custom builder is a group component that renders its children by id, and a rule component, both reading the store through useGroup and useRule. The custom UI guide builds one step by step.',
    links: [{ href: '/docs/guides/custom-ui', label: 'Custom UI guide' }],
  },
  {
    q: 'Is it only for React?',
    a: 'This file is React. Vue, Svelte and Solid have the same hooks as composables and primitives, and @qnot/dom has binding helpers for plain DOM, so the same approach works in each.',
    links: [
      { href: '/vue-query-builder', label: 'Vue' },
      { href: '/svelte-query-builder', label: 'Svelte' },
      { href: '/solid-query-builder', label: 'Solid' },
    ],
  },
  {
    q: 'Is it accessible?',
    a: 'It starts from native elements: <select> for pickers, <input> for values, <button> for actions and <details> for the add menu. They bring keyboard support and screen-reader semantics without extra libraries; check the result against your own requirements as you restyle.',
  },
  {
    q: 'Is it free?',
    a: 'Yes. MIT licensed, no API key, no account.',
  },
];

export default function Page() {
  return (
    <KitPage
      path="/headless-query-builder"
      component="QueryBuilder"
      facts={[
        ['license', 'MIT'],
        ['markup', 'Native HTML'],
        ['styling', 'Tailwind classes'],
        ['install', 'One shadcn add'],
      ]}
      faq={faq}
      importLine="import { QueryBuilder } from '@/components/qnot/kits/headless';"
      kit="headless"
      lede="Typed hooks over a fast store, and a complete builder in plain HTML and Tailwind to start from. Swap in your design system one control at a time."
      name="headless"
      notes={
        <>
          <p>
            <code>kits/headless.tsx</code> is the whole look: each control is a few lines of markup implementing a small <code>Kit</code> interface.{' '}
            <code>kits/shared/builder.tsx</code> turns <Link href="/docs/reference/hooks">@qnot/react's hooks</Link> into the builder around them. Replace a control with your
            design system's component and the rest keeps working.
          </p>
          <p>
            The <Link href="/shadcn-query-builder">shadcn/ui</Link> and <Link href="/mui-query-builder">MUI</Link> kits are the same <code>Kit</code> interface filled in with
            other components; read them side by side to see how little changes.
          </p>
        </>
      }
      setup={<p>No setup beyond Tailwind CSS and a components.json: plain HTML elements styled with Tailwind classes.</p>}
      tags={['MIT', 'headless', 'native HTML', 'Tailwind']}
      title="Headless query builder"
    />
  );
}
