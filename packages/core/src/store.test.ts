import { describe, expect, it, vi } from 'vitest';
import { createQueryStore, type Query } from './index';
import { fields } from './fixtures.test-helpers';

const q: Query = {
  kind: 'group',
  combinator: 'and',
  children: [
    { kind: 'rule', field: 'name', operator: 'eq', value: 'Ada' },
    { kind: 'group', combinator: 'or', children: [{ kind: 'rule', field: 'age', operator: 'gt', value: 30 }] },
  ],
};

const setup = () => {
  const store = createQueryStore({ fields, initial: q as any });
  const root = store.getGroup(store.rootId);
  return { store, ruleId: root.children[0]!, groupId: root.children[1]! };
};

describe('store', () => {
  it('round-trips the initial query', () => {
    const { store } = setup();
    expect(store.getQuery()).toEqual(q);
  });

  it('notifies only the edited node and keeps unchanged subtrees identical', () => {
    const { store, ruleId, groupId } = setup();
    const before = store.getQuery();
    const onRule = vi.fn();
    const onGroup = vi.fn();
    const onAll = vi.fn();
    store.subscribe(ruleId, onRule);
    store.subscribe(groupId, onGroup);
    store.subscribe(onAll);
    store.setRuleValue(ruleId, 'Grace');
    expect(onRule).toHaveBeenCalledTimes(1);
    expect(onGroup).not.toHaveBeenCalled();
    expect(onAll).toHaveBeenCalledTimes(1);
    const after = store.getQuery();
    expect(after).not.toBe(before);
    expect(after.children[1]).toBe(before.children[1]);
    expect(store.getQuery()).toBe(after);
  });

  it('coerces values when the operator changes arity', () => {
    const { store, groupId } = setup();
    const id = store.getGroup(groupId).children[0]!;
    store.setOperator(id, 'between');
    expect(store.getRule(id)).toMatchObject({ operator: 'between', value: [30, null] });
    store.setOperator(id, 'in');
    expect(store.getRule(id)).toMatchObject({ value: [30] });
    store.setOperator(id, 'isNull');
    expect('value' in store.getRule(id)).toBe(false);
  });

  it('resets operator and value when the field kind changes', () => {
    const { store, ruleId } = setup();
    store.setOperator(ruleId, 'contains');
    store.setField(ruleId, 'age');
    expect(store.getRule(ruleId)).toMatchObject({ field: 'age', operator: 'eq', value: null });
    store.setRuleValue(ruleId, 40);
    store.setField(ruleId, 'minAge');
    expect(store.getRule(ruleId)).toMatchObject({ field: 'minAge', value: 40 });
  });

  it('adds, clones, moves and removes', () => {
    const { store, ruleId, groupId } = setup();
    const added = store.addRule(groupId, { field: 'status', operator: 'eq', value: 'active' })!;
    expect(store.getGroup(groupId).children).toHaveLength(2);
    const copy = store.clone(ruleId)!;
    expect(store.getGroup(store.rootId).children[1]).toBe(copy);
    expect(store.move(ruleId, groupId, 0)).toBe(true);
    expect(store.getGroup(groupId).children[0]).toBe(ruleId);
    expect(store.getRule(ruleId).parent).toBe(groupId);
    expect(store.move(groupId, groupId, 0)).toBe(false);
    store.remove(added);
    expect(store.get(added)).toBeUndefined();
    store.remove(groupId);
    expect(store.get(ruleId)).toBeUndefined();
  });

  it('moves within the same parent account for the removed slot', () => {
    const { store, ruleId, groupId } = setup();
    const third = store.addRule(store.rootId)!;
    store.move(ruleId, store.rootId, 3);
    expect(store.getGroup(store.rootId).children).toEqual([groupId, third, ruleId]);
  });

  it('undoes and redoes, merging consecutive keystrokes', () => {
    const { store, ruleId } = setup();
    store.setRuleValue(ruleId, 'G');
    store.setRuleValue(ruleId, 'Gr');
    store.setRuleValue(ruleId, 'Gra');
    store.addRule(store.rootId);
    expect(store.getGroup(store.rootId).children).toHaveLength(3);
    store.undo();
    expect(store.getGroup(store.rootId).children).toHaveLength(2);
    store.undo();
    expect(store.getQuery()).toEqual(q);
    expect(store.canUndo()).toBe(false);
    store.redo();
    expect(store.getRule(ruleId)).toMatchObject({ value: 'Gra' });
  });

  it('batches several edits into one notification and one undo step', () => {
    const { store, ruleId } = setup();
    const onAll = vi.fn();
    store.subscribe(onAll);
    store.batch(() => {
      store.setCombinator(store.rootId, 'or');
      store.setNot(store.rootId, true);
      store.setRuleValue(ruleId, 'x');
    });
    expect(onAll).toHaveBeenCalledTimes(1);
    store.undo();
    expect(store.getQuery()).toEqual(q);
  });

  it('reconciles an external query, keeping ids of unchanged and positionally-matched nodes', () => {
    const { store, ruleId, groupId } = setup();
    const current = store.getQuery();
    const onGroup = vi.fn();
    store.subscribe(groupId, onGroup);
    store.setQuery({ ...current, children: [{ kind: 'rule', field: 'name', operator: 'eq', value: 'Lin' }, current.children[1]!] });
    expect(store.getGroup(store.rootId).children).toEqual([ruleId, groupId]);
    expect(store.getRule(ruleId)).toMatchObject({ value: 'Lin' });
    expect(onGroup).not.toHaveBeenCalled();
    expect(store.getQuery().children[1]).toBe(current.children[1]);
  });

  it('treats passing back its own query as a no-op', () => {
    const { store } = setup();
    const onAll = vi.fn();
    store.subscribe(onAll);
    store.setQuery(store.getQuery());
    expect(onAll).not.toHaveBeenCalled();
  });

  it('reconciles moved subtrees by identity', () => {
    const { store, ruleId, groupId } = setup();
    const cur = store.getQuery();
    store.setQuery({ ...cur, children: [cur.children[1]!, cur.children[0]!] });
    expect(store.getGroup(store.rootId).children).toEqual([groupId, ruleId]);
  });

  it('reports issues per node, cached until the node changes', () => {
    const { store, ruleId } = setup();
    expect(store.issues(ruleId)).toEqual([]);
    store.setRuleValue(ruleId, '');
    const issues = store.issues(ruleId);
    expect(issues[0]?.code).toBe('required');
    expect(store.issues(ruleId)).toBe(issues);
    expect(store.isValid()).toBe(false);
  });

  it('supports field refs', () => {
    const { store, groupId } = setup();
    const id = store.getGroup(groupId).children[0]!;
    store.setRef(id, 'minAge');
    expect(store.getNodeJSON(id)).toEqual({ kind: 'rule', field: 'age', operator: 'gt', ref: 'minAge' });
    store.setRef(id, null);
    expect(store.getNodeJSON(id)).toEqual({ kind: 'rule', field: 'age', operator: 'gt', value: null });
  });
});
