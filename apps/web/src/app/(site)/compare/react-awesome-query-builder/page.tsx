import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import Link from 'next/link';
import { metricValue } from '@/components/seo/bench-tables';
import type { FaqItem } from '@/components/seo/blocks';
import { ComparePage } from '@/components/seo/compare-page';

export const metadata: Metadata = pageMetadata({
  title: 'react-awesome-query-builder vs qnot: speed, features',
  description:
    'qnot and react-awesome-query-builder (RAQB) compared: features, measured speed at 1,000 rules, bundle size, when RAQB fits better, and keeping saved trees.',
  path: '/compare/react-awesome-query-builder',
});

export const faq: FaqItem[] = [
  {
    q: 'Does qnot do everything RAQB does?',
    a: 'Nearly. Field types, structs, list groups with counts, functions on both sides, field references, custom operators, locks, read-only modes, switch cases and every RAQB export format are covered and tested. Not carried over: custom conjunctions (XOR, NOR), paged "load more" for async lists, validateValue returning a fixed value, and slider marks.',
    links: [{ href: '/docs/guides/migrate-raqb', label: 'Migrating from RAQB' }],
  },
  {
    q: 'Can I keep my saved RAQB trees?',
    a: "Yes. With format: raqb the store's value / onChange read and write RAQB's JSON tree (QbUtils.getTree output), including rule_group list groups, functions mapped to RAQB's basic functions, and locks.",
  },
  {
    q: 'Do I still need Immutable.js?',
    a: 'No. qnot keeps the query as plain JSON, structurally shared, so unchanged parts keep their identity between edits. There is no Immutable.js and no Redux.',
  },
  {
    q: 'What about my antd or Fluent widgets?',
    a: 'RAQB ships widget packages for Ant Design, MUI, Bootstrap and Fluent. qnot ships builders for coss ui, shadcn/ui and MUI, plus a headless one to restyle. For Ant Design or Fluent you build the controls from the hooks; the headless kit shows how small that file is.',
    links: [{ href: '/headless-query-builder', label: 'Headless builder' }],
  },
];

export default function Page() {
  const v = (id: 'qnot' | 'raqb', m: 'add' | 'js') => metricValue(id, m);
  return (
    <ComparePage
      path="/compare/react-awesome-query-builder"
      benchIntro={
        <>
          The same tree in both, production builds, headless Chromium. The largest gaps are adding a rule ({v('raqb', 'add')} ms against {v('qnot', 'add')} ms) and size:
          RAQB is {v('raqb', 'js')} KB of gzipped JavaScript without React, qnot {v('qnot', 'js')} KB, both counting their SQL export.
        </>
      }
      better={
        <ul>
          <li>
            <strong>You use Ant Design or Fluent.</strong> RAQB's widget packages give you a builder in your kit with no UI code of your own.
          </li>
          <li>
            <strong>You need XOR or NOR conjunctions</strong>, paged "load more" async lists, <code>validateValue</code> that rewrites values, or slider marks. qnot has
            none of these.
          </li>
          <li>
            <strong>You have a large, working RAQB config</strong> and no performance problem. The migration is mostly mechanical, but it is still work.
          </li>
          <li>
            <strong>You want a longer track record.</strong> RAQB has been used in production for years by many teams.
          </li>
        </ul>
      }
      docs={{ href: '/docs/guides/migrate-raqb', label: 'Migration guide' }}
      faq={faq}
      features={[
        { feature: 'License', qnot: 'MIT', them: 'MIT' },
        { feature: 'UI frameworks', qnot: 'React, Vue, Svelte, Solid and plain DOM', them: 'React', edge: 'qnot' },
        { feature: 'Widget sets', qnot: 'coss ui, shadcn/ui, MUI and headless builders as source', them: 'Ant Design, MUI, Bootstrap, Fluent and vanilla widget packages', edge: 'them' },
        { feature: 'State', qnot: 'Plain JSON, normalized store with per-node subscriptions', them: 'Immutable.js tree; JSON through QbUtils.getTree' },
        { feature: 'Field types', qnot: 'text, number, boolean, date, time, datetime, enum, multi-enum, tree options, struct, list', them: 'The same set' },
        { feature: 'Functions and field references', qnot: 'On either side of a rule, nestable', them: 'On either side of a rule, nestable' },
        { feature: 'List groups and counts', qnot: 'some / all / none / count', them: 'some / all / none / count' },
        { feature: 'Custom conjunctions', qnot: 'AND, OR, NOT only (NOR is NOT + OR)', them: 'Configurable, e.g. XOR and NOR', edge: 'them' },
        { feature: 'Async options', qnot: 'search(query, signal), custom values', them: 'asyncFetch with paged "load more"', edge: 'them' },
        { feature: 'Undo and redo', qnot: 'Built into the store', them: 'No', edge: 'qnot' },
        { feature: 'Evaluate in JS', qnot: 'compile() / matches()', them: 'No', edge: 'qnot' },
        { feature: 'Export', qnot: 'SQL (5 dialects, bound params), MongoDB, JsonLogic, Elasticsearch, SpEL, text', them: 'SQL, MongoDB, JsonLogic, Elasticsearch, SpEL, query string' },
        { feature: 'Import', qnot: 'SQL WHERE, MongoDB, JsonLogic, SpEL, RAQB tree', them: 'SQL, JsonLogic, SpEL, tree' },
        { feature: 'Add a rule at 1,000 rules', qnot: `${v('qnot', 'add')} ms`, them: `${v('raqb', 'add')} ms`, edge: 'qnot' },
      ]}
      id="raqb"
      lede={
        <>
          react-awesome-query-builder is one of the most complete React query builders, and qnot was built to match it feature for feature. The differences: qnot runs outside React,
          keeps the query as plain JSON, adds undo and in-JS evaluation, and is a fraction of the size. It also{' '}
          <Link href="#switching">reads and writes RAQB trees</Link>.
        </>
      }
      ours={['qnot']}
      switching={{
        title: 'Filters.tsx',
        file: 'raqb-dropin.tsx',
        lang: 'tsx',
        intro: (
          <>
            Give the store <code>format: raqb</code>. Its <code>value</code> and <code>onChange</code> speak RAQB's JSON tree, so stored trees keep loading and keep being
            saved in the same shape.
          </>
        ),
        after: (
          <>
            <p>
              The config becomes a schema: <code>type: 'select'</code> is <code>f.enum()</code>, <code>!struct</code> is <code>f.struct()</code>, <code>!group</code> is{' '}
              <code>f.array()</code>, <code>asyncFetch</code> is <code>search</code>, <code>settings</code> become store settings.
            </p>
            <p>
              <code>QbUtils.sqlFormat</code> and friends map to <code>encode</code> with the matching codec. The <Link href="/docs/guides/migrate-raqb">migration guide</Link> has
              the full table, and <Link href="/playground">the playground</Link> shows every RAQB feature on one schema.
            </p>
          </>
        ),
      }}
      title="qnot vs react-awesome-query-builder"
    />
  );
}
