// A request handler with no DOM and no React: validate the client's query, then run it in SQL
// (parameterized) or in memory.
import { assertValidQuery, compile, encode, sanitizeQuery, type QueryOf } from '../../packages/core/src/index';
import { sqlFormat } from '../../packages/core/src/formats/sql';
import { fields } from './fields';

const postgres = sqlFormat({ dialect: 'postgres', params: 'numbered' });

export function handle(body: unknown) {
  const query = sanitizeQuery(fields, body as QueryOf<typeof fields>, { removeIncompleteRules: true });
  assertValidQuery(fields, query); // throws a 400-worthy error listing each bad rule; narrows to StrictQueryOf
  const { sql, params } = encode(postgres, query, fields) as { sql: string; params: unknown[] };
  return { sql: `SELECT * FROM users WHERE ${sql}`, params };
}

// What a client would POST (e.g. straight from useQuery() in the browser).
const body = {
  kind: 'group',
  combinator: 'and',
  children: [
    { kind: 'rule', field: 'age', operator: 'gte', value: 21 },
    { kind: 'rule', field: 'plan', operator: 'in', value: ['pro', 'team'] },
    { kind: 'rule', field: 'name', operator: 'contains', value: "O'Brien; DROP TABLE users" },
    { kind: 'rule', field: 'signedUp', operator: 'gt', call: { fn: 'relativeDate', args: { amount: { value: 30 }, unit: { value: 'day' }, direction: { value: 'ago' } } } },
    { kind: 'rule', field: 'name', operator: 'eq', value: '' },
  ],
};
console.log(handle(body));

const rows = [
  { name: "Ada O'Brien; DROP TABLE users", age: 36, plan: 'pro', signedUp: new Date().toISOString().slice(0, 10) },
  { name: 'Grace', age: 85, plan: 'free', signedUp: '2020-01-01' },
];
console.log('in-memory matches:', rows.filter(compile(fields, sanitizeQuery(fields, body as never, { removeIncompleteRules: true }))).map((r) => r.name));

try {
  handle({ kind: 'group', combinator: 'and', children: [{ kind: 'rule', field: 'age', operator: 'gte', value: -5 }] });
} catch (e) {
  console.log('rejected:', (e as Error).message);
}
