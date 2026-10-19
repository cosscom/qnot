import { defineFields, encode, f, type Query } from '../../packages/core/src/index';
import { sqlFormat } from '../../packages/core/src/formats/sql';
const fields = defineFields({ name: f.text(), age: f.number(), plan: f.enum(['free', 'pro', 'team']), verified: f.boolean(), city: f.text() });
const keys = Object.keys(fields);
const tree = (n: number): Query => {
  const groups: any[] = [];
  for (let i = 0; i < n; i++) {
    if (i % 10 === 0) groups.push({ kind: 'group', combinator: 'or', children: [] });
    const k = keys[i % keys.length]!;
    groups[groups.length - 1].children.push({ kind: 'rule', field: k, operator: 'eq', value: k === 'age' ? i : k === 'plan' ? 'pro' : k === 'verified' ? true : `v${i}` });
  }
  return { kind: 'group', combinator: 'and', children: groups };
};
const sql = sqlFormat({ dialect: 'postgres', params: 'numbered' });
const q = tree(10_000);
for (let i = 0; i < 60; i++) encode(sql, structuredClone(q), fields);
