import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import Link from 'next/link';
import { metricValue } from '@/components/seo/bench-tables';
import type { FaqItem } from '@/components/seo/blocks';
import { ComparePage } from '@/components/seo/compare-page';

export const metadata: Metadata = pageMetadata({
  title: 'DevExtreme FilterBuilder vs qnot: speed, licensing',
  description:
    'qnot and the DevExtreme FilterBuilder compared: licensing, features, measured speed at 1,000 rules, bundle size, and when DevExtreme fits better.',
  path: '/compare/devextreme-filterbuilder',
});

export const faq: FaqItem[] = [
  {
    q: 'Is DevExtreme free?',
    a: 'No. DevExtreme is a commercial suite from DevExpress, licensed per developer; see DevExpress licensing for the current terms. qnot is MIT licensed.',
  },
  {
    q: 'Why does DevExtreme have no keystroke number?',
    a: 'Its FilterBuilder shows values as text and opens an editor when you click one, so there is no inline input to type into. That is a design choice, and it is also why it renders large trees with few DOM nodes.',
  },
  {
    q: 'Can qnot filter a DevExtreme DataGrid?',
    a: "Not directly: qnot's output is its own JSON, not a DevExtreme filter expression. Filter on your server instead (encode the query to SQL or a MongoDB filter and load the grid's data source from the result), or write the reverse of the converter above. If the grid is the center of your app, FilterBuilder's native expressions are the shorter path.",
  },
  {
    q: 'How do I convert saved filter expressions?',
    a: "The function above walks DevExtreme's nested array format ([field, operation, value], joined by 'and' / 'or', negated with '!') and builds a qnot query. Run validateQuery on the result to catch operations that didn't map.",
  },
];

export default function Page() {
  const v = (id: 'qnot-dom' | 'devextreme', m: 'mount' | 'add' | 'js' | 'heap') => metricValue(id, m);
  return (
    <ComparePage
      path="/compare/devextreme-filterbuilder"
      benchIntro={
        <>
          DevExtreme's widget is plain JavaScript, so it runs against qnot's framework-free build; the React build is listed too. DevExtreme renders values as text, which
          keeps its first render close to qnot's ({Math.round(v('devextreme', 'mount') ?? 0)} ms against {Math.round(v('qnot-dom', 'mount') ?? 0)} ms). It ran unlicensed,
          with its trial banner showing.
        </>
      }
      better={
        <ul>
          <li>
            <strong>Your app is built around DevExtreme's DataGrid or PivotGrid.</strong> FilterBuilder's value is the grid's own filter expression, so it plugs straight in.
          </li>
          <li>
            <strong>You already license DevExtreme</strong> and want one theme and one vendor across grids, charts, schedulers and forms.
          </li>
          <li>
            <strong>You build with Angular or ASP.NET.</strong> DevExtreme supports both; qnot has no binding for them.
          </li>
          <li>
            <strong>You want a compact, click-to-edit filter.</strong> Values shown as text take less room than a row of inputs, which suits dense admin screens.
          </li>
        </ul>
      }
      docs={{ href: '/docs', label: 'Docs' }}
      faq={faq}
      features={[
        { feature: 'License', qnot: 'MIT', them: 'Commercial, per developer', edge: 'qnot' },
        { feature: 'Frameworks', qnot: 'React, Vue, Svelte, Solid, plain DOM', them: 'jQuery, Angular, React, Vue; ASP.NET wrappers' },
        { feature: 'Part of a suite', qnot: 'No, one library', them: 'Yes: DataGrid, PivotGrid, charts, schedulers, forms', edge: 'them' },
        { feature: 'Value editing', qnot: 'Inline editors for every value', them: 'Values shown as text; an editor opens on click' },
        { feature: 'Output', qnot: 'Plain JSON, typed by the schema', them: 'DevExtreme filter expression (nested arrays)' },
        { feature: 'Export formats', qnot: 'SQL (5 dialects, bound params), MongoDB, JsonLogic, Elasticsearch, SpEL, text', them: 'None built in; the expression feeds DevExtreme data sources', edge: 'qnot' },
        { feature: 'Grid integration', qnot: 'Through your data layer', them: 'Native with DataGrid and PivotGrid', edge: 'them' },
        { feature: 'Group operations', qnot: 'AND, OR, NOT', them: 'And, Or, Not And, Not Or' },
        { feature: 'Custom operations', qnot: 'defineOperator() with evaluation and per-format output', them: 'customOperations' },
        { feature: 'Undo, drag and drop', qnot: 'Built in', them: 'Not built in', edge: 'qnot' },
        { feature: 'JS, gzipped', qnot: `${v('qnot-dom', 'js')} KB`, them: `${v('devextreme', 'js')} KB`, edge: 'qnot' },
        { feature: 'Add a rule, 1,000 rules', qnot: `${v('qnot-dom', 'add')} ms`, them: `${v('devextreme', 'add')} ms` },
      ]}
      id="devextreme"
      lede={
        <>
          DevExtreme's FilterBuilder is a compact, click-to-edit filter made to drive its own DataGrid. qnot is a standalone MIT query builder with inline editors, typed
          values and export to SQL, MongoDB and JsonLogic. Saved expressions <Link href="#switching">convert with one small function</Link>.
        </>
      }
      ours={['qnot-dom', 'qnot']}
      switching={{
        title: 'from-devextreme.ts',
        file: 'from-devextreme.ts',
        lang: 'ts',
        intro: (
          <>
            There's no drop-in format for DevExtreme, but filter expressions are plain nested arrays. This function converts them, including <code>'!'</code> negation and{' '}
            <code>anyof</code> / <code>noneof</code>.
          </>
        ),
        after: (
          <>
            <p>
              Fields become a schema: <code>dataType: 'string'</code> is <code>f.text()</code>, or <code>f.enum()</code> with a <code>lookup</code>; <code>'number'</code>,{' '}
              <code>'boolean'</code> and <code>'date'</code> map to <code>f.number()</code>, <code>f.boolean()</code>, <code>f.date()</code>.
            </p>
            <p>
              Then mount a <Link href="/javascript-query-builder">framework-free</Link>, <Link href="/react-query-builder">React</Link> or{' '}
              <Link href="/vue-query-builder">Vue</Link> builder on the result.
            </p>
          </>
        ),
      }}
      title="qnot vs DevExtreme FilterBuilder"
    />
  );
}
