import { defineFields, encode, f, type Query } from '@trawlnet/core';
import { jsonlogic } from '@trawlnet/core/formats/jsonlogic';
import { mongo } from '@trawlnet/core/formats/mongo';
import { sqlFormat } from '@trawlnet/core/formats/sql';
import { ServerIcon } from 'lucide-react';
import { useMemo } from 'react';
import { CodeBlock } from '@/components/code-block';
import { CossQueryBuilder } from '@/coss/QueryBuilder';
import { ExampleFrame, type ExampleMeta } from './frame';
import { useExampleStore, useLiveQuery } from './shared';

export const meta: ExampleMeta = {
  id: 'server-side',
  title: 'One query, every backend',
  blurb: 'The same query as Postgres, MySQL, SQL Server, MongoDB and JsonLogic',
  icon: ServerIcon,
  category: 'Integration',
};

const fields = defineFields({
  name: f.text(),
  email: f.text(),
  age: f.number({ min: 0 }),
  plan: f.enum(['free', 'pro', 'team']),
  active: f.boolean(),
  createdAt: f.date({ label: 'Created at' }),
});

const CODECS = [
  { label: 'Postgres · parameterized', codec: sqlFormat({ dialect: 'postgres', params: 'numbered', quoteIdentifiers: true }) },
  { label: 'MySQL · inline, escaped', codec: sqlFormat({ dialect: 'mysql', quoteIdentifiers: true }) },
  { label: 'SQL Server · named params', codec: sqlFormat({ dialect: 'mssql', params: 'named' }) },
  { label: 'MongoDB filter', codec: mongo },
  { label: 'JsonLogic', codec: jsonlogic },
] as const;

const code = `
// One endpoint, any storage. Validate first, then encode for the backend you have.
app.post('/search', async (req, res) => {
  const query = req.body.query;
  if (!isValidQuery(fields, query)) return res.status(400).json(validateQuery(fields, query));

  const { sql, params } = encode(sqlFormat({ dialect: 'postgres', params: 'numbered' }), query, fields);
  res.json(await pg.query(\`SELECT * FROM users WHERE \${sql}\`, params));

  // or: db.collection('users').find(encode(mongo, query, fields))
  // or: jsonLogic.apply(encode(jsonlogic, query, fields), record)
});
`;

export function Demo() {
  const store = useExampleStore(fields, {
    kind: 'group',
    combinator: 'and',
    children: [
      { kind: 'rule', field: 'name', operator: 'eq', value: "O'Brien'); DROP TABLE users;--" },
      { kind: 'rule', field: 'email', operator: 'endsWith', value: '%@acme.com' },
      {
        kind: 'group',
        combinator: 'or',
        not: true,
        children: [
          { kind: 'rule', field: 'plan', operator: 'in', value: ['free'] },
          { kind: 'rule', field: 'age', operator: 'between', value: [13, 17] },
        ],
      },
      { kind: 'rule', field: 'createdAt', operator: 'gte', value: '2026-01-01' },
    ],
  });
  const query = useLiveQuery(store);
  const outputs = useMemo(
    () =>
      CODECS.map(({ label, codec }) => {
        const out = encode(codec as never, query as Query, fields) as unknown;
        if (typeof out === 'string') return { label, text: out };
        // SQL with bound parameters: show the statement as-is with its params underneath.
        if (out && typeof out === 'object' && 'sql' in out && 'params' in out) {
          const { sql, params } = out as { sql: string; params: unknown };
          return { label, text: `${sql}\n\n-- params\n${JSON.stringify(params, null, 2)}` };
        }
        return { label, text: JSON.stringify(out, null, 2) };
      }),
    [query],
  );
  return (
    <ExampleFrame meta={meta} code={code} description="Build once, run anywhere. The first rule is a SQL-injection attempt and the email rule contains a LIKE wildcard: watch every dialect escape them (or turn them into bound parameters). Codecs are memoized per node, so re-encoding after an edit only touches the changed branch.">
      <div className="flex flex-col gap-4">
        <CossQueryBuilder store={store} />
        <div className="grid gap-3 lg:grid-cols-2">
          {outputs.map((o) => (
            <CodeBlock key={o.label} wrap label={o.label} code={o.text} />
          ))}
        </div>
      </div>
    </ExampleFrame>
  );
}
