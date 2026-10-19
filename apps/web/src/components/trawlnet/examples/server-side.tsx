// Part of trawlnet (https://github.com/sean-brydon/trawlnet). MIT licensed; installable with shadcn.
'use client';
import { defineFields, encode, f, type Codec, type Query } from '@trawlnet/core';
import { jsonlogic } from '@trawlnet/core/formats/jsonlogic';
import { mongo } from '@trawlnet/core/formats/mongo';
import { sqlFormat } from '@trawlnet/core/formats/sql';
import { ServerIcon } from 'lucide-react';
import { useMemo } from 'react';
import { CodeBlock } from '@/components/trawlnet/code-block';
import { CossQueryBuilder } from '@/components/trawlnet/query-builder';
import { useExampleStore, useLiveQuery } from '@/components/trawlnet/examples/shared';



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
        const out: unknown = encode(codec as Codec<unknown>, query as Query, fields);
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
    <>
      <div className="flex flex-col gap-4">
        <CossQueryBuilder store={store} />
        <div className="grid gap-3 lg:grid-cols-2">
          {outputs.map((o) => (
            <CodeBlock key={o.label} wrap label={o.label} code={o.text} />
          ))}
        </div>
      </div>
    </>
  );
}
