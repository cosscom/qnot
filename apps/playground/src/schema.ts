// The main playground's schema: one of every RAQB-parity feature (structs, lists, multi-select,
// tree options, async search, time/datetime, widgets, a custom operator and functions).
import { builtinFunctions, defineFields, defineOperator, f, type QueryOf } from '@trawlnet/core';

/** Custom operator: "is within N km". Evaluates in JS and exports to SQL. */
export const near = defineOperator({
  id: 'near',
  arity: 'one',
  label: 'is within (km)',
  symbol: '≲',
  evaluate: (distance, km) => typeof distance === 'number' && typeof km === 'number' && distance <= km,
  formats: {
    sql: ({ field, value }) => `${String(field)} <= ${String(value)}`,
    mongo: ({ field, raw }) => ({ [String(field)]: { $lte: raw } }),
    text: ({ field, value }) => `${String(field)} is within ${String(value)} km`,
  },
});

export const COMPANIES = ['Acme', 'Globex', 'Initech', 'Umbrella', 'Hooli', 'Soylent', 'Stark Industries', 'Wayne Enterprises', 'Vandelay Industries', 'Wonka', 'Cyberdyne', 'Tyrell', 'Massive Dynamic', 'Pied Piper'];

/** Simulates a remote lookup: 250 ms latency, abortable. */
async function searchCompanies(query: string, signal?: AbortSignal) {
  await new Promise<void>((resolve, reject) => {
    const t = setTimeout(resolve, 250);
    signal?.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('aborted', 'AbortError'));
    });
  });
  const q = query.toLowerCase();
  return COMPANIES.filter((c) => c.toLowerCase().includes(q))
    .slice(0, 8)
    .map((c) => ({ value: c, label: c }));
}

export const REGIONS = [
  {
    value: 'emea',
    label: 'EMEA',
    children: [
      { value: 'de', label: 'Germany' },
      { value: 'gb', label: 'United Kingdom' },
      { value: 'fr', label: 'France' },
    ],
  },
  {
    value: 'amer',
    label: 'Americas',
    children: [
      { value: 'us', label: 'United States' },
      { value: 'br', label: 'Brazil' },
    ],
  },
  {
    value: 'apac',
    label: 'APAC',
    children: [
      { value: 'jp', label: 'Japan' },
      { value: 'in', label: 'India' },
    ],
  },
];

export const fields = defineFields(
  {
    name: f.text(),
    email: f.text({ pattern: /^[^@\s]+@[^@\s]+$/, description: 'Work email' }),
    age: f.number({ min: 0, max: 120, integer: true }),
    minAge: f.number({ label: 'Minimum age' }),
    plan: f.enum(['free', 'pro', 'team', 'enterprise']),
    tags: f.multiEnum(['vip', 'beta', 'churn-risk', 'partner', 'newsletter']),
    region: f.enum(REGIONS, { leafOnly: true, description: 'Pick a country; regions group them' }),
    company: f.enum<string>([], { search: searchCompanies, allowCustom: true, description: 'Searched remotely as you type' }),
    verified: f.boolean(),
    satisfaction: f.number({ min: 0, max: 10, widget: 'slider' }),
    distanceKm: f.number({ label: 'Distance from HQ', suffix: 'km', min: 0, extraOperators: ['near'] }),
    opensAt: f.time({ label: 'Office opens' }),
    lastSeen: f.datetime({ label: 'Last seen' }),
    signedUp: f.date({ label: 'Signed up' }),
    notes: f.text({ widget: 'textarea', required: false }),
    address: f.struct({ city: f.text(), zip: f.text({ column: 'postal_code', label: 'ZIP' }) }, { label: 'Address' }),
    orders: f.array(
      {
        product: f.enum(['Mast', 'Sail', 'Keel', 'Rudder', 'Anchor']),
        qty: f.number({ min: 1, integer: true, label: 'Quantity' }),
        status: f.enum(['paid', 'pending', 'refunded']),
      },
      { label: 'Orders' },
    ),
  },
  { operators: [near], functions: builtinFunctions },
);

export type Fields = typeof fields;

export const initial: QueryOf<Fields> = {
  kind: 'group',
  combinator: 'and',
  children: [
    { kind: 'rule', field: 'age', operator: 'gte', value: 21 },
    { kind: 'rule', field: 'tags', operator: 'hasAny', value: ['vip', 'beta'] },
    { kind: 'rule', field: 'region', operator: 'in', value: ['de', 'gb', 'us'] },
    {
      kind: 'group',
      combinator: 'or',
      children: [
        { kind: 'rule', field: { fn: 'lower', args: { text: { ref: 'name' } } }, operator: 'contains', value: 'a' },
        { kind: 'rule', field: 'signedUp', operator: 'gt', call: { fn: 'relativeDate', args: { amount: { value: 2 }, unit: { value: 'year' }, direction: { value: 'ago' } } } },
        { kind: 'rule', field: 'age', operator: 'gt', ref: 'minAge' },
      ],
    },
    {
      kind: 'group',
      combinator: 'and',
      of: { field: 'orders', match: { count: 'gte', value: 2 } },
      children: [{ kind: 'rule', field: 'status', operator: 'eq', value: 'paid' }],
    },
    { kind: 'rule', field: 'distanceKm', operator: 'near', value: 3000 },
  ],
};
