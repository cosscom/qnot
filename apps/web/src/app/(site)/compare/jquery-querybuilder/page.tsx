import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import Link from 'next/link';
import { metricValue } from '@/components/seo/bench-tables';
import type { FaqItem } from '@/components/seo/blocks';
import { ComparePage } from '@/components/seo/compare-page';

export const metadata: Metadata = pageMetadata({
  title: 'jQuery QueryBuilder vs qnot: features, speed, migration',
  description:
    'qnot and jQuery QueryBuilder compared: features, plugins, measured speed at 1,000 rules, bundle size, when the plugin fits better, and keeping getRules() JSON.',
  path: '/compare/jquery-querybuilder',
});

export const faq: FaqItem[] = [
  {
    q: 'Can qnot load the rules I saved from jQuery QueryBuilder?',
    a: "Yes. Create the store with format: jqqb and initial set to your saved getRules() output. store.getValue() keeps returning the same { condition, rules } shape, so the server side doesn't change.",
  },
  {
    q: 'Do I need jQuery or Bootstrap?',
    a: 'No. @qnot/dom uses plain DOM APIs and ships a small stylesheet of its own. If the rest of your app uses Bootstrap, the builder sits next to it without conflict.',
  },
  {
    q: 'Can I switch one page at a time?',
    a: 'Yes. Both builders can live in the same app, and because qnot speaks the same JSON, a query saved by one page loads in the other.',
  },
  {
    q: 'Is jQuery QueryBuilder still a good choice?',
    a: "For a jQuery app with modest queries, yes. It is mature, MIT licensed and its plugins cover SQL, MongoDB, drag and drop and NOT groups. It slows down on very large queries: about 0.9 s to render 1,000 rules in our run.",
  },
];

export default function Page() {
  const m = (id: 'qnot-dom' | 'jqqb') => Math.round(metricValue(id, 'mount') ?? 0);
  return (
    <ComparePage
      path="/compare/jquery-querybuilder"
      benchIntro={
        <>
          jQuery QueryBuilder renders plain DOM, so the fair comparison is qnot's framework-free build, <code>@qnot/dom</code>; the React build is listed too. At 1,000 rules
          the first render takes {m('jqqb')} ms against {m('qnot-dom')} ms. Its sizes include jQuery and, for CSS, Bootstrap.
        </>
      }
      better={
        <ul>
          <li>
            <strong>Your app is built on jQuery and Bootstrap.</strong> The plugin fits the way the rest of the page already works, and its look matches.
          </li>
          <li>
            <strong>Your queries are small.</strong> At ten rules it renders in about 26 ms and a keystroke is a tenth of a millisecond. There is nothing to gain on speed.
          </li>
          <li>
            <strong>Its plugins already do what you need.</strong> SQL and MongoDB import and export, sortable rules, NOT groups, unique filters and filter descriptions are
            all there, and it has years of use behind it.
          </li>
        </ul>
      }
      docs={{ href: '/docs/guides/vanilla', label: 'Vanilla guide' }}
      faq={faq}
      features={[
        { feature: 'License', qnot: 'MIT', them: 'MIT' },
        { feature: 'Depends on', qnot: '@qnot/core only', them: 'jQuery, Bootstrap 5 and Bootstrap Icons (dependencies of 3.0)', edge: 'qnot' },
        { feature: 'Frameworks', qnot: 'Plain DOM, plus React, Vue, Svelte and Solid bindings on the same store', them: 'jQuery plugin', edge: 'qnot' },
        { feature: 'SQL', qnot: 'Export in five dialects with bound params; import of WHERE clauses', them: 'sql-support plugin: export and import' },
        { feature: 'MongoDB', qnot: 'Export and import', them: 'mongodb-support plugin' },
        { feature: 'Also exports', qnot: 'JsonLogic, Elasticsearch, SpEL, plain English', them: 'No other formats built in', edge: 'qnot' },
        { feature: 'Drag and drop', qnot: 'Built in', them: 'sortable plugin' },
        { feature: 'NOT groups', qnot: 'Built in', them: 'not-group plugin' },
        { feature: 'Undo and redo', qnot: 'Built into the store', them: 'Not included', edge: 'qnot' },
        { feature: 'Functions, list groups, field references', qnot: 'Yes', them: 'Not built in', edge: 'qnot' },
        { feature: 'TypeScript', qnot: 'Written in TypeScript; rule values typed by the schema', them: 'JavaScript, no bundled type definitions', edge: 'qnot' },
        { feature: 'First render, 1,000 rules', qnot: `${m('qnot-dom')} ms`, them: `${m('jqqb')} ms`, edge: 'qnot' },
      ]}
      id="jqqb"
      lede={
        <>
          jQuery QueryBuilder has served jQuery apps well for more than a decade. qnot does the same job without jQuery or Bootstrap, adds typed values, undo and more export formats,
          and stays fast on large queries. It reads and writes <Link href="#switching">the same JSON</Link>, so saved rules keep working.
        </>
      }
      ours={['qnot-dom', 'qnot']}
      switching={{
        title: 'filters.ts',
        file: 'jqqb-dropin.ts',
        lang: 'ts',
        intro: (
          <>
            Create the store with <code>format: jqqb</code>. It loads the JSON that <code>getRules()</code> returned, and <code>getValue()</code> gives the same shape back.
          </>
        ),
        after: (
          <>
            <p>
              Filters become a schema: <code>type: 'integer'</code> is <code>f.number({'{'} integer: true {'}'})</code>, <code>input: 'select'</code> with{' '}
              <code>values</code> is <code>f.enum()</code>, a radio of yes / no is <code>f.boolean()</code>.
            </p>
            <p>
              Operators map by name: <code>equal</code> to <code>eq</code>, <code>begins_with</code> to <code>startsWith</code>, <code>is_null</code> to{' '}
              <code>isNull</code>. See the <Link href="/docs/guides/vanilla">vanilla guide</Link> for mounting options.
            </p>
          </>
        ),
      }}
      title="qnot vs jQuery QueryBuilder"
    />
  );
}
