import { describe, expectTypeOf, it } from 'vitest';
import { createQueryStore, f, defineFields, compile, isValidQuery, type QueryOf, type RuleOf, type RowOf } from './index';
import { fields } from './fixtures.test-helpers';

type R = RuleOf<typeof fields>;

describe('schema-typed rules', () => {
  it('narrows value by field and operator', () => {
    const check = (r: R) => {
      if (r.field === 'age' && r.operator === 'between' && r.ref === undefined) expectTypeOf(r.value).toEqualTypeOf<readonly [number | null, number | null]>();
      if (r.field === 'age' && r.operator === 'in') expectTypeOf(r.value).toEqualTypeOf<readonly number[]>();
      if (r.field === 'status' && r.operator === 'eq' && r.ref === undefined) expectTypeOf(r.value).toEqualTypeOf<'active' | 'pending' | 'banned' | null>();
      if (r.field === 'name' && r.operator === 'contains') expectTypeOf(r.value).toEqualTypeOf<string | null>();
      if (r.field === 'joined' && r.operator === 'gt' && r.ref === undefined) expectTypeOf(r.value).toEqualTypeOf<string | null>();
    };
    void check;
  });

  it('only allows operators the field declares', () => {
    const ok: R = { kind: 'rule', field: 'score', operator: 'between', value: [1, 2] };
    // @ts-expect-error score does not allow 'lt'
    const bad: R = { kind: 'rule', field: 'score', operator: 'lt', value: 1 };
    // @ts-expect-error booleans have no 'contains'
    const bad2: R = { kind: 'rule', field: 'verified', operator: 'contains', value: 'x' };
    void [ok, bad, bad2];
  });

  it('rejects values of the wrong type', () => {
    // @ts-expect-error age is a number
    const bad: R = { kind: 'rule', field: 'age', operator: 'eq', value: 'old' };
    // @ts-expect-error not an enum member
    const bad2: R = { kind: 'rule', field: 'status', operator: 'eq', value: 'deleted' };
    void [bad, bad2];
  });

  it('types field refs to same-kind fields', () => {
    const ok: R = { kind: 'rule', field: 'age', operator: 'gt', ref: 'minAge' };
    // @ts-expect-error cannot compare a number to a text field
    const bad: R = { kind: 'rule', field: 'age', operator: 'gt', ref: 'name' };
    // @ts-expect-error 'in' cannot take a ref
    const bad2: R = { kind: 'rule', field: 'age', operator: 'in', ref: 'minAge' };
    void [ok, bad, bad2];
  });

  it('lets nullary operators omit value', () => {
    const ok: R = { kind: 'rule', field: 'name', operator: 'isNull' };
    void ok;
  });

  it('types whole queries and nested groups', () => {
    const q: QueryOf<typeof fields> = {
      kind: 'group',
      combinator: 'and',
      children: [
        { kind: 'rule', field: 'age', operator: 'gte', value: 21 },
        { kind: 'group', combinator: 'or', not: true, children: [{ kind: 'rule', field: 'status', operator: 'in', value: ['active'] }] },
      ],
    };
    void q;
  });

  it('strict queries have no nulls after isValidQuery', () => {
    const q = {} as QueryOf<typeof fields>;
    if (isValidQuery(fields, q)) {
      const r = q.children[0];
      if (r?.kind === 'rule' && r.field === 'age' && r.operator === 'eq' && r.ref === undefined) expectTypeOf(r.value).toEqualTypeOf<number>();
    }
  });

  it('types rows for compile()', () => {
    const pred = compile(fields, { kind: 'group', combinator: 'and', children: [] });
    expectTypeOf(pred).parameter(0).toEqualTypeOf<RowOf<typeof fields>>();
    expectTypeOf<RowOf<typeof fields>['age']>().toEqualTypeOf<number | null | undefined>();
  });

  it('types store field names and initial values', () => {
    const store = createQueryStore({ fields });
    store.setField('x', 'age');
    // @ts-expect-error unknown field
    store.setField('x', 'nope');
    expectTypeOf(store.getQuery()).toEqualTypeOf<QueryOf<typeof fields>>();
  });

  it('infers enum values from object options', () => {
    const fs = defineFields({ plan: f.enum([{ value: 1, label: 'Free' }, { value: 2, label: 'Pro' }]) });
    const check = (r: RuleOf<typeof fs>) => {
      if (r.operator === 'eq' && r.ref === undefined) expectTypeOf(r.value).toEqualTypeOf<1 | 2 | null>();
    };
    void check;
  });
});
