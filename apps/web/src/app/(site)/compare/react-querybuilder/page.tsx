import type { Metadata } from 'next';
import Link from 'next/link';
import { metricValue } from '@/components/seo/bench-tables';
import type { FaqItem } from '@/components/seo/blocks';
import { ComparePage } from '@/components/seo/compare-page';

export const metadata: Metadata = {
  title: 'qnot vs react-querybuilder: features, speed, migration',
  description:
    'An honest comparison of qnot and react-querybuilder: features, measured speed at 1,000 rules, bundle size, where react-querybuilder is the better choice, and a drop-in path for saved queries.',
  alternates: { canonical: '/compare/react-querybuilder' },
};

export const faq: FaqItem[] = [
  {
    q: 'Can qnot read my saved react-querybuilder queries?',
    a: "Yes. Give the store format: rqb and value / onChange read and write react-querybuilder's RuleGroupType, including value sources and the independent-combinators shape. Nothing in your database has to change.",
    links: [{ href: '/docs/guides/migrate-react-querybuilder', label: 'Migration guide' }],
  },
  {
    q: 'Is react-querybuilder slow?',
    a: 'Not for typical queries. Up to about a hundred rules, every library here responds within a frame. The gap opens on large trees: in our run, typing into one rule of a 1,000-rule query took about 57 ms in react-querybuilder and 0.4 ms in qnot.',
  },
  {
    q: 'Which one has more export formats?',
    a: 'react-querybuilder. Its formatQuery covers SQL, parameterized SQL, MongoDB, CEL, SpEL, JsonLogic, Elasticsearch, JSONata, LDAP, Prisma, Drizzle, Sequelize, Cypher, SPARQL, Gremlin and more. qnot covers SQL in five dialects, MongoDB, JsonLogic, Elasticsearch, SpEL and plain English.',
  },
  {
    q: 'Do I have to rewrite my UI?',
    a: 'You replace the builder component and translate the fields array into a defineFields schema; the mapping is mostly one to one. If you use a react-querybuilder compat package for your UI kit, pick the qnot builder for your kit (coss ui, shadcn/ui, MUI) or keep the default one.',
  },
];

export default function Page() {
  const k = (id: 'qnot' | 'rqb') => metricValue(id, 'keystroke');
  return (
    <ComparePage
      benchIntro={
        <>
          The same tree in both, production builds, headless Chromium. react-querybuilder's cost per keystroke grows with the size of the query: {k('rqb')} ms at 1,000 rules against {k('qnot')} ms for qnot, whose rules each subscribe to their own node.
        </>
      }
      better={
        <ul>
          <li>
            <strong>You need React Native.</strong> react-querybuilder has a React Native package. qnot's bindings target the DOM.
          </li>
          <li>
            <strong>You need an export format qnot doesn't have.</strong> CEL, LDAP, JSONata, Prisma, Drizzle, Sequelize, Cypher, SPARQL and Gremlin are built into
            react-querybuilder's formatQuery, along with parsers for several of them.
          </li>
          <li>
            <strong>You want the larger ecosystem.</strong> It has been in production use for years, has many more users, and compatibility
            packages for Ant Design, Bootstrap, Bulma, Chakra, Fluent, Mantine, MUI and Tremor.
          </li>
          <li>
            <strong>Your queries stay small.</strong> Below a hundred rules both feel instant, and switching buys you little on speed alone.
          </li>
        </ul>
      }
      docs={{ href: '/docs/guides/migrate-react-querybuilder', label: 'Migration guide' }}
      faq={faq}
      features={[
        { feature: 'License', qnot: 'MIT', them: 'MIT' },
        { feature: 'UI frameworks', qnot: 'React, Vue, Svelte, Solid and plain DOM, over one framework-agnostic store', them: 'React (core logic is framework-agnostic)', edge: 'qnot' },
        { feature: 'React Native', qnot: 'No', them: 'Yes, separate package', edge: 'them' },
        { feature: 'UI kits', qnot: 'coss ui, shadcn/ui, MUI and headless builders, installed as source with shadcn add', them: 'Official compatibility packages, including MUI, Ant Design, Chakra, Fluent and Mantine' },
        { feature: 'Typed rule values', qnot: 'Values narrow by field and operator from the schema; validated queries come back strict', them: 'Field and operator names are typeable; value is any by default', edge: 'qnot' },
        { feature: 'Export formats', qnot: 'SQL (5 dialects, bound params), MongoDB, JsonLogic, Elasticsearch, SpEL, text', them: '20+ formats, including CEL, LDAP, Prisma, Drizzle, Cypher, SPARQL', edge: 'them' },
        { feature: 'Import', qnot: 'SQL WHERE, MongoDB, JsonLogic, SpEL; react-querybuilder, RAQB and jQuery QB JSON', them: 'SQL, MongoDB, JsonLogic, CEL, SpEL, JSONata, Cypher, Gremlin, SPARQL' },
        { feature: 'Undo and redo', qnot: 'Built into the store', them: 'Yes, with QueryBuilderHistory' },
        { feature: 'Drag and drop', qnot: 'Built in (HTML5, mouse)', them: 'Yes, @react-querybuilder/dnd with react-dnd' },
        { feature: 'Evaluate in JS', qnot: 'compile() / matches() filter rows in the browser or on the server', them: 'Through JsonLogic export and a JsonLogic runtime' },
        { feature: 'Keystroke at 1,000 rules', qnot: `${k('qnot')} ms`, them: `${k('rqb')} ms`, edge: 'qnot' },
      ]}
      id="rqb"
      lede={
        <>
          react-querybuilder is the most used React query builder, and a good one. qnot is newer, runs outside React too, types values by field, and stays fast on very large
          queries. It also reads and writes react-querybuilder's JSON, so you can <Link href="#switching">switch without migrating data</Link>.
        </>
      }
      ours={['qnot']}
      switching={{
        title: 'Filters.tsx',
        file: 'rqb-dropin.tsx',
        lang: 'tsx',
        intro: (
          <>
            Give the store <code>format: rqb</code>. Its <code>value</code> and <code>onChange</code> now speak react-querybuilder's <code>RuleGroupType</code>, so stored
            queries load as they are and keep being saved in the same shape.
          </>
        ),
        after: (
          <>
            <p>
              Fields move from an array to a <code>defineFields</code> object: <code>inputType: 'number'</code> becomes <code>f.number()</code>, a select becomes{' '}
              <code>f.enum()</code>. Operators map one to one (<code>=</code> to <code>eq</code>, <code>beginsWith</code> to <code>startsWith</code>).
            </p>
            <p>
              <code>formatQuery(query, 'sql')</code> becomes <code>encode(sqlFormat(), query, fields)</code>. The <Link href="/docs/guides/migrate-react-querybuilder">migration guide</Link>{' '}
              has the full tables.
            </p>
          </>
        ),
      }}
      title="qnot vs react-querybuilder"
    />
  );
}
