import type { Metadata } from 'next';
import { pageMetadata } from '@/lib/seo';
import Link from 'next/link';
import type { FaqItem } from '@/components/seo/blocks';
import { FrameworkPage } from '@/components/seo/framework-page';

export const metadata: Metadata = pageMetadata({
  title: 'JavaScript Query Builder: open-source, no framework',
  description:
    'A vanilla JavaScript query builder with no framework and no jQuery: mount it on any element, export to SQL, MongoDB and JsonLogic. MIT, about 23 KB gzipped.',
  path: '/javascript-query-builder',
});

export const faq: FaqItem[] = [
  {
    q: 'Is it free?',
    a: 'Yes. @qnot/dom and @qnot/core are MIT licensed. No license key, no paid tier.',
  },
  {
    q: 'Does it need jQuery or a framework?',
    a: 'No. @qnot/dom renders with plain DOM APIs. The whole benchmark page, including the SQL export, is about 23 KB of gzipped JavaScript.',
  },
  {
    q: 'Does it work in server-rendered apps (Rails, Django, Laravel) or web components?',
    a: 'Yes. mountQueryBuilder takes any element and returns a dispose function, so it fits a Stimulus controller, an Alpine component, a custom element or a plain script tag that your bundler builds. @qnot/dom depends only on @qnot/core.',
  },
  {
    q: 'How do I read the query?',
    a: 'store.getQuery() returns the query as JSON, and store.subscribe(fn) calls you after every change. Encode it with any codec: SQL with bound parameters, MongoDB, JsonLogic, Elasticsearch, SpEL or plain English.',
    links: [{ href: '/docs/concepts/formats', label: 'Formats' }],
  },
  {
    q: 'Is it a replacement for jQuery QueryBuilder?',
    a: "It can be. It reads and writes jQuery QueryBuilder's getRules() JSON through the jqqb format, so saved rules keep working, and it renders 1,000 rules in about an eighth of the time in our benchmark. If your app is built on jQuery and Bootstrap and the plugin does what you need, there's no pressing reason to switch.",
    links: [{ href: '/compare/jquery-querybuilder', label: 'qnot vs jQuery QueryBuilder' }],
  },
  {
    q: 'Can I customize the controls?',
    a: 'Yes. mountQueryBuilder takes components, labels, className, showNot and showLock. A custom value editor is a factory returning { el, update(props), destroy }; it is created once and patched in place as the rule changes.',
    links: [{ href: '/docs/guides/vanilla', label: 'Vanilla guide' }],
  },
];

const sample = `import '@qnot/core/styles.css';
import { createQueryStore, encode } from '@qnot/core';
import { sqlFormat } from '@qnot/core/formats/sql';
import { mountQueryBuilder } from '@qnot/dom';
import { fields, initial } from './fields';

const pg = sqlFormat({ dialect: 'postgres', params: 'numbered' });
const store = createQueryStore({ fields, initial });
const output = document.getElementById('sql')!;

const dispose = mountQueryBuilder(document.getElementById('filters')!, store, { showLock: true });

// { sql: 'age >= $1 AND plan IN ($2, $3) AND …', params: [21, 'pro', 'team', …] }
const render = () => (output.textContent = encode(pg, store.getQuery(), fields).sql);
render();
store.subscribe(render);
// later: dispose();`;

export default function Page() {
  return (
    <FrameworkPage
      path="/javascript-query-builder"
      api={
        <>
          <p>
            Each node subscribes to its own id and patches only its own elements, with a keyed reconcile per group, so the vanilla builder keeps the same one-rule-one-update
            behaviour as the framework bindings. <code>bindDragHandle</code>, <code>bindDropTarget</code> and <code>bindGroupDropZone</code> wire drag and drop into your own
            markup.
          </p>
          <p>
            Web components, Alpine, htmx, Rails or Django templates: anything that hands you an element can host it. See the <Link href="/docs/guides/vanilla">vanilla guide</Link>.
          </p>
        </>
      }
      compare={{
        ids: ['jqqb', 'syncfusion', 'devextreme'],
        against: 'qnot-dom',
        intro: (
          <>
            The other framework-free query builders are jQuery QueryBuilder and the commercial Syncfusion and DevExtreme components. Here is how they measure up, with{' '}
            <Link href="/benchmarks">the same 1,000-rule tree</Link>.
          </>
        ),
      }}
      dndHref="/docs/guides/vanilla#drag-and-drop-helpers"
      docsHref="/docs/guides/vanilla"
      faq={faq}
      framework="vanilla"
      lede="A query builder in plain JavaScript: no framework, no jQuery. Mount it on any element and get a typed query, undo, drag and drop and export to SQL, MongoDB and JsonLogic."
      name="JavaScript"
      pkg="@qnot/dom"
      sample={{ file: 'filters.ts', lang: 'ts', code: sample }}
      tags={['MIT', 'no dependencies', '~23 KB gz', 'TypeScript']}
      title="JavaScript query builder"
    />
  );
}
