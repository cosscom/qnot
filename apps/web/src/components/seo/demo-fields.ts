import { defineFields, f, type QueryOf } from '@qnot/core';

export const fields = defineFields({
  name: f.text(),
  age: f.number({ min: 0, max: 120, integer: true }),
  plan: f.enum(['free', 'pro', 'team', 'enterprise']),
  tags: f.multiEnum(['vip', 'beta', 'churn-risk', 'partner']),
  verified: f.boolean(),
  signedUp: f.date({ label: 'Signed up' }),
});

export const initial: QueryOf<typeof fields> = {
  kind: 'group',
  combinator: 'and',
  children: [
    { kind: 'rule', field: 'age', operator: 'gte', value: 21 },
    { kind: 'rule', field: 'plan', operator: 'in', value: ['pro', 'team'] },
    {
      kind: 'group',
      combinator: 'or',
      children: [
        { kind: 'rule', field: 'tags', operator: 'hasAny', value: ['vip'] },
        { kind: 'rule', field: 'signedUp', operator: 'gt', value: '2025-01-01' },
      ],
    },
  ],
};
