import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import Link from 'next/link';
import { metricValue } from '@/components/seo/bench-tables';
import type { FaqItem } from '@/components/seo/blocks';
import { ComparePage } from '@/components/seo/compare-page';

export const metadata: Metadata = pageMetadata({
  title: 'Syncfusion Query Builder vs qnot: speed, licensing',
  description:
    'qnot and the Syncfusion Query Builder compared: licensing, features, measured speed at 100 and 1,000 rules, bundle size, and when Syncfusion fits better.',
  path: '/compare/syncfusion-query-builder',
});

export const faq: FaqItem[] = [
  {
    q: 'Is the Syncfusion Query Builder free?',
    a: 'Under conditions. Syncfusion offers a free community license to organizations with less than $1 million in annual gross revenue and five or fewer developers; everyone else needs a commercial license. qnot is MIT licensed for everyone.',
  },
  {
    q: 'Which frameworks does each support?',
    a: 'Syncfusion\'s query builder is a JavaScript component with wrappers for Angular, React and Vue, and versions for Blazor and ASP.NET. qnot has bindings for React, Vue, Svelte and Solid, and a plain DOM builder; it has no Angular or Blazor binding.',
  },
  {
    q: 'Why is the Syncfusion number so high at 1,000 rules?',
    a: 'In our run its first render grows faster than linearly with the number of rules: about 0.27 s at 100 rules, 2 s at 500 and 6.6 s at 1,000. Typing into a rule stays fast. If your queries stay under a hundred rules, render time is unlikely to matter.',
    links: [{ href: '/benchmarks', label: 'Benchmarks' }],
  },
  {
    q: 'Can I convert my saved Syncfusion rules?',
    a: "Yes. getRules() returns a plain RuleModel tree; the twenty-line function above turns it into a qnot query, mapping each operator. Run validateQuery on the result to catch anything that didn't map.",
  },
];

export default function Page() {
  const m = (id: 'qnot-dom' | 'syncfusion', n: 100 | 1000 = 1000) => Math.round(metricValue(id, 'mount', n) ?? 0);
  return (
    <ComparePage
      path="/compare/syncfusion-query-builder"
      benchIntro={
        <>
          Syncfusion's component is plain JavaScript, so it runs against qnot's framework-free build; the React build is listed too. At 100 rules Syncfusion renders in{' '}
          {m('syncfusion', 100)} ms, at 1,000 in {m('syncfusion').toLocaleString('en-US')} ms. It ran unlicensed, with its trial banner showing; behavior is otherwise the
          same.
        </>
      }
      better={
        <ul>
          <li>
            <strong>You already license Syncfusion Essential Studio.</strong> The query builder comes with it, themed like the grid, charts and schedulers you use.
          </li>
          <li>
            <strong>You build with Angular, Blazor or ASP.NET.</strong> qnot has no binding for them.
          </li>
          <li>
            <strong>You want a vendor behind it.</strong> Commercial licenses come with support and a company accountable for fixes.
          </li>
          <li>
            <strong>Your queries are small to medium.</strong> Under a hundred rules, Syncfusion renders in a few hundred milliseconds or less and typing is instant.
          </li>
        </ul>
      }
      docs={{ href: '/docs', label: 'Docs' }}
      faq={faq}
      features={[
        { feature: 'License', qnot: 'MIT, for everyone', them: 'Commercial, or free community license under $1M revenue and 5 developers', edge: 'qnot' },
        { feature: 'Frameworks', qnot: 'React, Vue, Svelte, Solid, plain DOM', them: 'JavaScript, Angular, React, Vue; Blazor and ASP.NET versions' },
        { feature: 'Part of a suite', qnot: 'No, one library', them: 'Yes: grids, charts, schedulers and more, one theme', edge: 'them' },
        { feature: 'SQL', qnot: 'Export in five dialects with bound params; import of WHERE clauses', them: 'Export and import, plus parameterized and named-parameter SQL' },
        { feature: 'MongoDB', qnot: 'Export and import', them: 'Export and import' },
        { feature: 'Also exports', qnot: 'JsonLogic, Elasticsearch, SpEL, plain English', them: 'Not built in', edge: 'qnot' },
        { feature: 'Drag and drop', qnot: 'Built in', them: 'Yes (allowDragAndDrop)' },
        { feature: 'NOT, read-only, limits', qnot: 'Yes', them: 'Yes (enableNotCondition, readonly, maxGroupCount)' },
        { feature: 'Undo and redo', qnot: 'Built into the store', them: 'Not built in', edge: 'qnot' },
        { feature: 'Typed rule values', qnot: 'Narrowed by field and operator from the schema', them: 'A union of primitives, not tied to the field', edge: 'qnot' },
        { feature: 'Evaluate in JS', qnot: 'compile() / matches() on any array, browser or server', them: 'getPredicate() for filtering through its DataManager' },
        { feature: 'Support', qnot: 'GitHub issues', them: 'Commercial support with a license', edge: 'them' },
        { feature: 'First render, 1,000 rules', qnot: `${m('qnot-dom')} ms`, them: `${m('syncfusion').toLocaleString('en-US')} ms`, edge: 'qnot' },
      ]}
      id="syncfusion"
      lede={
        <>
          Syncfusion's Query Builder is a polished commercial component in a large suite. qnot is a single MIT library: free for everyone, typed from your schema, with more
          export formats, and fast at a thousand rules. Saved rules <Link href="#switching">convert with one small function</Link>.
        </>
      }
      ours={['qnot-dom', 'qnot']}
      switching={{
        title: 'from-syncfusion.ts',
        file: 'from-syncfusion.ts',
        lang: 'ts',
        intro: (
          <>
            There's no drop-in format for Syncfusion, but its <code>getRules()</code> output is a plain tree. This function converts it, operator by operator. Run it once over
            saved rules, or on load while both builders coexist.
          </>
        ),
        after: (
          <>
            <p>
              Columns become a schema: <code>type: 'string'</code> is <code>f.text()</code>, or <code>f.enum()</code> when it has <code>values</code>;{' '}
              <code>'number'</code>, <code>'boolean'</code> and <code>'date'</code> map to <code>f.number()</code>, <code>f.boolean()</code>, <code>f.date()</code>.
            </p>
            <p>
              Operators qnot doesn't know pass through unchanged, so <code>validateQuery(fields, query)</code> lists them instead of the converter dropping them. Then pick a{' '}
              <Link href="/javascript-query-builder">framework-free</Link>, <Link href="/react-query-builder">React</Link> or <Link href="/vue-query-builder">Vue</Link>{' '}
              builder.
            </p>
          </>
        ),
      }}
      title="qnot vs Syncfusion Query Builder"
    />
  );
}
