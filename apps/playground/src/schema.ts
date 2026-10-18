import { defineFields, f, type QueryOf } from '@trawlnet/core';

export const fields = defineFields({
  name: f.text(),
  email: f.text({ pattern: /^[^@\s]+@[^@\s]+$/ }),
  age: f.number({ min: 0, max: 120, integer: true }),
  minAge: f.number({ label: 'Minimum age' }),
  plan: f.enum(['free', 'pro', 'team', 'enterprise']),
  country: f.enum([
    { value: 'US', label: 'United States' },
    { value: 'GB', label: 'United Kingdom' },
    { value: 'DE', label: 'Germany' },
    { value: 'JP', label: 'Japan' },
  ]),
  verified: f.boolean(),
  signedUp: f.date({ label: 'Signed up' }),
});

export type Fields = typeof fields;

export const initial: QueryOf<Fields> = {
  kind: 'group',
  combinator: 'and',
  children: [
    { kind: 'rule', field: 'age', operator: 'gte', value: 21 },
    { kind: 'rule', field: 'plan', operator: 'in', value: ['pro', 'team'] },
    {
      kind: 'group',
      combinator: 'or',
      children: [
        { kind: 'rule', field: 'country', operator: 'eq', value: 'US' },
        { kind: 'rule', field: 'verified', operator: 'eq', value: true },
      ],
    },
  ],
};
