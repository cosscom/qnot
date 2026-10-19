// Part of trawlnet (https://github.com/sean-brydon/trawlnet). MIT licensed; installable with shadcn.
'use client';
import { compile, defineFields, encode, f, type Query } from '@trawlnet/core';
import { sqlFormat } from '@trawlnet/core/formats/sql';
import { UsersRoundIcon } from 'lucide-react';
import { useMemo } from 'react';
import { CodeBlock } from '@/components/trawlnet/code-block';
import { Meter } from '@/components/ui/meter';
import { CossQueryBuilder } from '@/components/trawlnet/query-builder';
import { describeQuery } from '@/components/trawlnet/describe';
import { pickWith, rng, useExampleStore, useLiveQuery } from '@/components/trawlnet/examples/shared';



const fields = defineFields({
  lifecycle: f.enum(['Lead', 'Trial', 'Customer', 'Churned'], { label: 'Lifecycle stage' }),
  plan: f.enum(['Free', 'Starter', 'Growth', 'Enterprise']),
  country: f.enum([
    { value: 'US', label: 'United States' },
    { value: 'GB', label: 'United Kingdom' },
    { value: 'DE', label: 'Germany' },
    { value: 'BR', label: 'Brazil' },
    { value: 'IN', label: 'India' },
  ]),
  mrr: f.number({ label: 'MRR ($)', min: 0 }),
  seats: f.number({ min: 1, integer: true }),
  lastSeenDays: f.number({ label: 'Days since last seen', min: 0, integer: true }),
  emailOptIn: f.boolean({ label: 'Email opt-in' }),
  signupDate: f.date({ label: 'Signed up' }),
  company: f.text(),
});

const rand = rng(3);
const pick = pickWith(rand);
const CONTACTS = Array.from({ length: 5000 }, () => {
  const lifecycle = pick(['Lead', 'Trial', 'Customer', 'Customer', 'Churned'] as const);
  const plan = lifecycle === 'Customer' ? pick(['Starter', 'Growth', 'Growth', 'Enterprise'] as const) : 'Free';
  const seats = plan === 'Enterprise' ? 50 + Math.floor(rand() * 400) : 1 + Math.floor(rand() * 30);
  return {
    lifecycle,
    plan,
    country: pick(['US', 'US', 'GB', 'DE', 'BR', 'IN'] as const),
    seats,
    mrr: plan === 'Free' ? 0 : seats * ({ Starter: 8, Growth: 15, Enterprise: 28 } as const)[plan],
    lastSeenDays: Math.floor(rand() ** 2 * 120),
    emailOptIn: rand() > 0.3,
    signupDate: new Date(Date.UTC(2022, 0, 1) + rand() * 1000 * 864e5).toISOString().slice(0, 10),
    company: `${pick(['Acme', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Vandelay'])} ${pick(['Labs', 'Inc', 'GmbH', 'Ltda'])}`,
  };
});

const postgres = sqlFormat({ dialect: 'postgres', params: 'numbered', quoteIdentifiers: true });


export function Demo() {
  const store = useExampleStore(fields, {
    kind: 'group',
    combinator: 'and',
    children: [
      { kind: 'rule', field: 'lifecycle', operator: 'eq', value: 'Customer' },
      { kind: 'rule', field: 'emailOptIn', operator: 'eq', value: true },
      {
        kind: 'group',
        combinator: 'or',
        children: [
          { kind: 'rule', field: 'lastSeenDays', operator: 'gt', value: 30 },
          { kind: 'rule', field: 'mrr', operator: 'gte', value: 1000 },
        ],
      },
    ],
  });
  const query = useLiveQuery(store);
  const { count, mrr, sql } = useMemo(() => {
    const hits = CONTACTS.filter(compile(fields, query));
    const { sql, params } = encode(postgres, query as Query, fields);
    return {
      count: hits.length,
      mrr: hits.reduce((n, c) => n + c.mrr, 0),
      sql: `SELECT id, email\nFROM contacts\nWHERE ${sql};\n\n-- params\n${JSON.stringify(params)}`,
    };
  }, [query]);
  return (
    <>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <CossQueryBuilder store={store} />
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border p-4">
              <div className="text-muted-foreground text-xs">Audience</div>
              <div className="font-semibold text-2xl tabular-nums" data-audience>
                {count.toLocaleString('en-US')}
              </div>
              <Meter className="mt-2" value={count} max={CONTACTS.length} aria-label="Share of contacts" />
            </div>
            <div className="rounded-xl border p-4">
              <div className="text-muted-foreground text-xs">MRR in segment</div>
              <div className="font-semibold text-2xl tabular-nums">${mrr.toLocaleString('en-US')}</div>
              <div className="mt-2 text-muted-foreground text-xs">{((count / CONTACTS.length) * 100).toFixed(1)}% of contacts</div>
            </div>
          </div>
          <p className="rounded-xl bg-muted/50 p-3 text-sm leading-relaxed dark:bg-muted/30">
            <span className="text-muted-foreground">Contacts where </span>
            {describeQuery(fields, query as Query)}
          </p>
          <CodeBlock wrap label="Postgres (parameterized)" code={sql} lang="sql" />
        </div>
      </div>
    </>
  );
}
