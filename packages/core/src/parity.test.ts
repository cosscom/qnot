// Coverage for the RAQB-parity features (see docs/raqb-parity.md).
import { describe, expect, it, vi } from 'vitest';
import {
  builtinFunctions,
  compile,
  compileCases,
  createQueryStore,
  defineFields,
  defineOperator,
  editorFor,
  f,
  fieldOptions,
  fieldsFromJSON,
  fieldsToJSON,
  sanitizeQuery,
  validateQuery,
  type Query,
  type QueryOf,
} from './index';

const proximity = defineOperator({
  id: 'near',
  arity: 'one',
  label: 'is within',
  evaluate: (fieldValue, operand) => typeof fieldValue === 'number' && typeof operand === 'number' && Math.abs(fieldValue) <= operand,
  formats: { sql: ({ field, value }) => `ABS(${String(field)}) <= ${String(value)}` },
});

const fields = defineFields(
  {
    name: f.text(),
    bio: f.text({ widget: 'textarea', required: false }),
    distance: f.number({ operators: ['eq'], extraOperators: ['near'] }),
    tags: f.multiEnum(['vip', 'beta', 'churned']),
    region: f.enum([
      { value: 'emea', label: 'EMEA', children: [{ value: 'de', label: 'Germany' }, { value: 'fr', label: 'France' }] },
      { value: 'amer', label: 'Americas', children: [{ value: 'us', label: 'United States' }] },
    ], { leafOnly: true }),
    opensAt: f.time(),
    lastSeen: f.datetime(),
    secret: f.text({ hidden: true }),
    address: f.struct({ city: f.text(), zip: f.text({ column: 'postal_code' }) }, { label: 'Address' }),
    orders: f.array({ product: f.text(), qty: f.number(), status: f.enum(['paid', 'refunded']) }),
  },
  { operators: [proximity], functions: builtinFunctions, messages: { required: 'Fill this in' } },
);

const rows = [
  { name: 'Ada', distance: 3, tags: ['vip', 'beta'], region: 'de', opensAt: '09:00', address: { city: 'London', zip: 'N1' }, orders: [{ product: 'mast', qty: 2, status: 'paid' }, { product: 'sail', qty: 1, status: 'refunded' }] },
  { name: 'GRACE', distance: -12, tags: [], region: 'us', opensAt: '18:30', address: { city: 'New York', zip: '10001' }, orders: [] },
  { name: 'Linus', distance: 8, tags: ['churned'], region: 'fr', opensAt: null, address: { city: 'Helsinki', zip: '00100' }, orders: [{ product: 'keel', qty: 5, status: 'paid' }, { product: 'mast', qty: 1, status: 'paid' }, { product: 'tide', qty: 1, status: 'paid' }] },
];
const names = (q: QueryOf<typeof fields>) => rows.filter(compile(fields, q) as (r: unknown) => boolean).map((r) => r.name);
const and = (...children: QueryOf<typeof fields>['children']): QueryOf<typeof fields> => ({ kind: 'group', combinator: 'and', children });

describe('schema', () => {
  it('flattens structs into dotted, grouped fields and hides hidden ones from pickers', () => {
    expect(Object.keys(fields)).toContain('address.city');
    expect(fields['address.zip'].column).toBe('postal_code');
    const opts = fieldOptions(fields);
    expect(opts.find((o) => o.value === 'address.city')).toMatchObject({ label: 'City', group: 'Address' });
    expect(opts.some((o) => o.value === 'secret')).toBe(false);
    expect(opts.find((o) => o.value === 'orders')?.isArray).toBe(true);
  });

  it('describes editors for the new kinds and widgets', () => {
    expect(editorFor(fields.bio, 'eq', fields).type).toBe('textarea');
    expect(editorFor(fields.opensAt, 'gt', fields).type).toBe('time');
    expect(editorFor(fields.tags, 'hasAny', fields).type).toBe('multiselect');
    const region = editorFor(fields.region, 'eq', fields);
    expect(region.options?.map((o) => [o.value, o.depth, !!o.disabled])).toEqual([
      ['emea', 0, true],
      ['de', 1, false],
      ['fr', 1, false],
      ['amer', 0, true],
      ['us', 1, false],
    ]);
    expect(editorFor(fields.distance, 'near', fields).arity).toBe('one');
  });

  it('round-trips through JSON', () => {
    const validators = { even: (n: number) => (n % 2 ? 'Must be even' : undefined) };
    const fs = defineFields({ n: f.number({ validate: validators.even }), code: f.text({ pattern: /^[A-Z]+$/i }) });
    const json = JSON.parse(JSON.stringify(fieldsToJSON(fs, { fns: validators })));
    const back = fieldsFromJSON(json, { fns: validators });
    expect(back.code!.pattern?.test('abc')).toBe(true);
    expect(validateQuery(back, { kind: 'group', combinator: 'and', children: [{ kind: 'rule', field: 'n', operator: 'eq', value: 3 }] })[0]?.message).toBe('Must be even');
    expect(() => fieldsFromJSON(fieldsToJSON(fields), {})).toThrow(/near/);
  });
});

describe('evaluation', () => {
  it('handles multi-value, empty, time, tree and nested struct fields', () => {
    expect(names(and({ kind: 'rule', field: 'tags', operator: 'hasAll', value: ['vip', 'beta'] }))).toEqual(['Ada']);
    expect(names(and({ kind: 'rule', field: 'tags', operator: 'hasNone', value: ['vip'] }))).toEqual(['GRACE', 'Linus']);
    expect(names(and({ kind: 'rule', field: 'tags', operator: 'isEmpty' }))).toEqual(['GRACE']);
    expect(names(and({ kind: 'rule', field: 'tags', operator: 'setEq', value: ['beta', 'vip'] }))).toEqual(['Ada']);
    expect(names(and({ kind: 'rule', field: 'opensAt', operator: 'lt', value: '12:00' }))).toEqual(['Ada']);
    expect(names(and({ kind: 'rule', field: 'region', operator: 'in', value: ['de', 'fr'] }))).toEqual(['Ada', 'Linus']);
    expect(names(and({ kind: 'rule', field: 'address.city', operator: 'startsWith', value: 'new' }))).toEqual(['GRACE']);
  });

  it('runs custom operators', () => {
    expect(names(and({ kind: 'rule', field: 'distance', operator: 'near', value: 5 }))).toEqual(['Ada']);
  });

  it('evaluates functions on either side', () => {
    expect(names(and({ kind: 'rule', field: { fn: 'lower', args: { text: { ref: 'name' } } }, operator: 'eq', value: 'grace' }))).toEqual(['GRACE']);
    // Text comparisons are case-insensitive by default, so 'Ada' = UPPER('ada').
    expect(names(and({ kind: 'rule', field: 'name', operator: 'eq', call: { fn: 'upper', args: { text: { value: 'ada' } } } }))).toEqual(['Ada']);
    expect(names(and({ kind: 'rule', field: { fn: 'length', args: { text: { ref: 'name' } } }, operator: 'gt', value: 3 }))).toEqual(['GRACE', 'Linus']);
  });

  it('quantifies array groups: some / all / none / count', () => {
    const group = (match: any, ...children: any[]): any => ({ kind: 'group', combinator: 'and', of: { field: 'orders', match }, children });
    const paid = { kind: 'rule', field: 'status', operator: 'eq', value: 'paid' };
    expect(names(and(group('some', { kind: 'rule', field: 'product', operator: 'eq', value: 'mast' })))).toEqual(['Ada', 'Linus']);
    expect(names(and(group('all', paid)))).toEqual(['GRACE', 'Linus']);
    expect(names(and(group('none', paid)))).toEqual(['GRACE']);
    expect(names(and(group({ count: 'gte', value: 3 }, paid)))).toEqual(['Linus']);
    expect(names(and(group({ count: 'between', value: [1, 2] }, paid)))).toEqual(['Ada']);
  });

  it('picks the first matching case', () => {
    const route = compileCases(fields, {
      cases: [
        { when: and({ kind: 'rule', field: 'tags', operator: 'hasAny', value: ['vip'] }), then: 'concierge' },
        { when: and({ kind: 'rule', field: 'region', operator: 'in', value: ['de', 'fr'] }), then: 'emea-team' },
      ],
      otherwise: 'self-serve',
    });
    expect(rows.map((r) => route(r as never))).toEqual([
      { value: 'concierge', index: 0 },
      { value: 'self-serve', index: -1 },
      { value: 'emea-team', index: 1 },
    ]);
  });
});

describe('validation', () => {
  it('validates new kinds, tree leaves, functions and array scopes, with message overrides', () => {
    const q: Query = {
      kind: 'group',
      combinator: 'and',
      children: [
        { kind: 'rule', field: 'opensAt', operator: 'eq', value: '25:00' },
        { kind: 'rule', field: 'region', operator: 'eq', value: 'emea' },
        { kind: 'rule', field: 'name', operator: 'eq', value: '' },
        { kind: 'rule', field: { fn: 'nope', args: {} }, operator: 'eq', value: 1 },
        { kind: 'rule', field: 'lastSeen', operator: 'gt', call: { fn: 'lower', args: { text: { value: 'x' } } } },
        { kind: 'group', combinator: 'and', of: { field: 'orders', match: 'some' }, children: [{ kind: 'rule', field: 'qty', operator: 'gt', value: 'many' }] },
        { kind: 'group', combinator: 'and', of: { field: 'name', match: 'some' }, children: [] },
      ],
    };
    expect(validateQuery(fields, q).map((i) => [i.path, i.code, i.message])).toEqual([
      [[0], 'type', 'Expected a time (HH:mm)'],
      [[1], 'option', 'Not one of the allowed values'],
      [[2], 'required', 'Fill this in'],
      [[3], 'function', 'Unknown function "nope"'],
      [[4], 'function', 'Lowercase returns text, expected datetime'],
      [[5, 0], 'type', 'Expected a number'],
      [[6], 'arrayField', '"name" is not a list field'],
      [[6], 'emptyGroup', 'This group is empty'],
    ]);
  });

  it('sanitizes loaded queries', () => {
    const q = and(
      { kind: 'rule', field: 'name', operator: 'eq', value: '' },
      { kind: 'rule', field: 'tags', operator: 'hasAny', value: ['vip', 'ghost' as 'vip'] },
      { kind: 'rule', field: 'gone' as 'name', operator: 'eq', value: 'x' },
      { kind: 'group', combinator: 'or', children: [{ kind: 'rule', field: 'name', operator: 'eq', value: null }] },
    );
    const clean = sanitizeQuery(fields, q, { removeIncompleteRules: true, removeEmptyGroups: true, removeInvalidListValues: true });
    expect(clean.children).toEqual([{ kind: 'rule', field: 'tags', operator: 'hasAny', value: ['vip'] }]);
    const valid = and({ kind: 'rule', field: 'name', operator: 'eq', value: 'x' });
    expect(sanitizeQuery(fields, valid, { removeIncompleteRules: true })).toBe(valid);
  });
});

describe('store settings and locking', () => {
  const initial = and(
    { kind: 'rule', field: 'name', operator: 'eq', value: 'Ada' },
    { kind: 'group', combinator: 'or', children: [{ kind: 'rule', field: 'distance', operator: 'eq', value: 1 }] },
  );
  const setup = (settings = {}) => {
    const store = createQueryStore({ fields, initial, settings });
    const [rule, group] = store.getGroup(store.rootId).children as [string, string];
    return { store, rule, group, inner: store.getGroup(group).children[0]! };
  };

  it('enforces maxRules and maxDepth', () => {
    const { store, group } = setup({ maxRules: 3, maxDepth: 1 });
    expect(store.addRule(store.rootId)).not.toBeNull();
    expect(store.addRule(store.rootId)).toBeNull();
    expect(store.can('addRule', group)).toBe(false);
    store.setSettings({ maxRules: 10 });
    expect(store.addGroup(group)).toBeNull();
    expect(store.addGroup(store.rootId)).not.toBeNull();
  });

  it('locks nodes and their descendants', () => {
    const { store, group, inner } = setup();
    store.setLocked(group, true);
    store.setRuleValue(inner, 99);
    expect(store.getRule(inner)).toMatchObject({ value: 1 });
    store.remove(group);
    expect(store.get(group)).toBeDefined();
    expect(store.getQuery().children[1]).toMatchObject({ locked: true });
    store.setSettings({ canDeleteLocked: true });
    store.remove(group);
    expect(store.get(group)).toBeUndefined();
  });

  it('supports read-only and per-part immutability', () => {
    const { store, rule } = setup({ immutable: { fields: true } });
    store.setField(rule, 'bio');
    store.setRuleValue(rule, 'Grace');
    expect(store.getRule(rule)).toMatchObject({ field: 'name', value: 'Grace' });
    store.setSettings({ readOnly: true });
    store.setRuleValue(rule, 'Linus');
    expect(store.addRule(store.rootId)).toBeNull();
    expect(store.getRule(rule)).toMatchObject({ value: 'Grace' });
  });

  it('respects canReorder / canRegroup', () => {
    const { store, rule, group } = setup({ canRegroup: false });
    expect(store.move(rule, group, 0)).toBe(false);
    expect(store.move(group, store.rootId, 0)).toBe(true);
    store.setSettings({ canReorder: false });
    expect(store.move(rule, store.rootId, 0)).toBe(false);
  });

  it('removes groups emptied by a removal when canLeaveEmptyGroup is false', () => {
    const { store, group, inner } = setup({ canLeaveEmptyGroup: false });
    store.remove(inner);
    expect(store.get(group)).toBeUndefined();
  });

  it('creates groups with a starter rule unless emptyNewGroups', () => {
    const { store } = setup();
    const g = store.addGroup(store.rootId)!;
    expect(store.getGroup(g).children).toHaveLength(1);
    store.setSettings({ emptyNewGroups: true });
    expect(store.getGroup(store.addGroup(store.rootId)!).children).toHaveLength(0);
  });

  it('asks confirmRemove before requestRemove', async () => {
    const confirmRemove = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    const { store, rule } = setup({ confirmRemove });
    expect(await store.requestRemove(rule)).toBe(false);
    expect(store.get(rule)).toBeDefined();
    expect(await store.requestRemove(rule)).toBe(true);
    expect(store.get(rule)).toBeUndefined();
    expect(confirmRemove).toHaveBeenCalledWith({ kind: 'rule', field: 'name', operator: 'eq', value: 'Ada' });
  });

  it('scopes rules inside array groups to the element schema', () => {
    const { store } = setup();
    const g = store.addArrayGroup(store.rootId, 'orders', 'some')!;
    const r = store.getGroup(g).children[0]!;
    expect(store.getRule(r).field).toBe('product');
    expect(Object.keys(store.fieldsFor(r))).toEqual(['product', 'qty', 'status']);
    store.setField(r, 'qty');
    store.setRuleValue(r, 2);
    store.setMatch(g, { count: 'gte', value: 2 });
    expect(store.getNodeJSON(g)).toEqual({
      kind: 'group',
      combinator: 'and',
      of: { field: 'orders', match: { count: 'gte', value: 2 } },
      children: [{ kind: 'rule', field: 'qty', operator: 'eq', value: 2 }],
    });
    expect(store.issues(r)).toEqual([]);
  });

  it('sets function values and keeps them through operator changes', () => {
    const { store, rule } = setup();
    store.setField(rule, 'lastSeen');
    store.setOperator(rule, 'gt');
    store.setCall(rule, { fn: 'relativeDate', args: { amount: { value: 7 }, unit: { value: 'day' }, direction: { value: 'ago' } } });
    store.setOperator(rule, 'lt');
    expect(store.getNodeJSON(rule)).toMatchObject({ field: 'lastSeen', operator: 'lt', call: { fn: 'relativeDate' } });
  });

  it('skips no-op writes, so they never create undo steps', () => {
    const { store, group } = setup();
    const onAll = vi.fn();
    store.subscribe(onAll);
    store.setCombinator(group, 'or');
    store.setNot(group, false);
    expect(onAll).not.toHaveBeenCalled();
    expect(store.canUndo()).toBe(false);
  });

  it('tracks the rule count incrementally, including undo', () => {
    const { store, group } = setup();
    expect(store.ruleCount).toBe(2);
    store.remove(group);
    expect(store.ruleCount).toBe(1);
    store.undo();
    expect(store.ruleCount).toBe(2);
  });
});

describe('permission notifications', () => {
  it('fire on locks and settings, not on value edits', () => {
    const store = createQueryStore({ fields, initial: { kind: 'group', combinator: 'and', children: [{ kind: 'rule', field: 'name', operator: 'eq', value: 'a' }] } });
    const id = store.getGroup(store.rootId).children[0]!;
    const onPerm = vi.fn();
    store.subscribePermissions(onPerm);
    store.setRuleValue(id, 'b');
    store.addRule(store.rootId);
    expect(onPerm).not.toHaveBeenCalled();
    store.setLocked(id, true);
    expect(onPerm).toHaveBeenCalledTimes(1);
    store.setSettings({ maxRules: 5 });
    expect(onPerm).toHaveBeenCalledTimes(2);
    store.addRule(store.rootId);
    expect(onPerm).toHaveBeenCalledTimes(3);
  });
});
