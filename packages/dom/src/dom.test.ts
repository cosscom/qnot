// @vitest-environment jsdom
import { createQueryStore, defineFields, f, type QueryOf } from '@qnot/core';
import { afterEach, describe, expect, it } from 'vitest';
import { mountQueryBuilder } from './index';

const fields = defineFields({ name: f.text(), age: f.number(), status: f.enum(['active', 'banned']) });
const initial: QueryOf<typeof fields> = {
  kind: 'group',
  combinator: 'and',
  children: [
    { kind: 'rule', field: 'name', operator: 'eq', value: 'Ada' },
    { kind: 'rule', field: 'age', operator: 'gt', value: 30 },
    { kind: 'rule', field: 'status', operator: 'eq', value: 'active' },
  ],
};

let dispose = () => {};
afterEach(() => {
  dispose();
  document.body.innerHTML = '';
});

const setup = () => {
  const store = createQueryStore({ fields, initial });
  const host = document.createElement('div');
  document.body.append(host);
  dispose = mountQueryBuilder(host, store);
  return { store, host };
};

// Like a user: interacting with a control (focus) before changing it, which also expands lazy selects.
const type = (el: HTMLInputElement, value: string) => {
  el.dispatchEvent(new FocusEvent('focus'));
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
};
const choose = (el: HTMLSelectElement, value: string) => {
  el.dispatchEvent(new FocusEvent('focus'));
  el.value = value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
};

describe('mountQueryBuilder', () => {
  it('renders the tree and edits values', () => {
    const { store, host } = setup();
    expect(host.querySelectorAll('.qn-rule')).toHaveLength(3);
    type(host.querySelector('input.qn-value[type="text"]')!, 'Grace');
    expect(store.getQuery().children[0]).toEqual({ kind: 'rule', field: 'name', operator: 'eq', value: 'Grace' });
    type(host.querySelector('input.qn-value[type="number"]')!, '41');
    expect(store.getQuery().children[1]).toMatchObject({ value: 41 });
  });

  it('patches only the edited row', () => {
    const { host } = setup();
    const rows = [...host.querySelectorAll('.qn-rule')];
    const siblingControls = [...rows[1]!.querySelectorAll('*'), ...rows[2]!.querySelectorAll('*')];
    const observed: MutationRecord[] = [];
    const mo = new MutationObserver((m) => observed.push(...m));
    mo.observe(host, { subtree: true, childList: true, attributes: true, characterData: true });
    type(rows[0]!.querySelector('input.qn-value')!, 'Grace');
    const records = mo.takeRecords().concat(observed);
    mo.disconnect();
    expect(records.every((r) => !siblingControls.includes(r.target as Element) && !rows.slice(1).includes(r.target as Element))).toBe(true);
    expect([...host.querySelectorAll('.qn-rule')]).toEqual(rows);
  });

  it('switches editors with the operator and keeps draft text', () => {
    const { store, host } = setup();
    const ageRow = host.querySelectorAll('.qn-rule')[1]!;
    choose(ageRow.querySelector('select.qn-operator')!, 'between');
    expect(ageRow.querySelectorAll('.qn-value-pair input')).toHaveLength(2);
    const lo = ageRow.querySelectorAll<HTMLInputElement>('.qn-value-pair input')[0]!;
    expect(lo.value).toBe('30');
    choose(ageRow.querySelector('select.qn-operator')!, 'isNull');
    expect(ageRow.querySelector('.qn-value')).toBeNull();
    choose(ageRow.querySelector('select.qn-operator')!, 'in');
    const list = ageRow.querySelector<HTMLInputElement>('input.qn-value')!;
    type(list, '1, 2, ');
    expect(store.getRule(store.getGroup(store.rootId).children[1]!)).toMatchObject({ value: [1, 2] });
    expect(list.value).toBe('1, 2, ');
  });

  it('adds rules and groups, removes and clones', () => {
    const { store, host } = setup();
    const addGroup = [...host.querySelectorAll('button')].find((b) => b.textContent === '+ Group')!;
    addGroup.click();
    expect(host.querySelectorAll('.qn-group')).toHaveLength(2);
    const nested = host.querySelectorAll('.qn-group')[1]!;
    // New groups start with one rule (RAQB default).
    expect(nested.querySelectorAll('.qn-rule')).toHaveLength(1);
    [...nested.querySelectorAll('button')].find((b) => b.textContent === '+ Rule')!.click();
    expect(nested.querySelectorAll('.qn-rule')).toHaveLength(2);
    expect(store.getQuery().children[3]).toMatchObject({ kind: 'group', children: [{ kind: 'rule', field: 'name' }, { kind: 'rule', field: 'name' }] });
    const first = host.querySelector('.qn-rule')!;
    first.querySelector<HTMLButtonElement>('button[aria-label="Duplicate"]')!.click();
    expect(store.getGroup(store.rootId).children).toHaveLength(5);
    host.querySelector<HTMLButtonElement>('.qn-rule button[aria-label="Remove"]')!.click();
    expect(store.getGroup(store.rootId).children).toHaveLength(4);
    store.undo();
    expect(store.getGroup(store.rootId).children).toHaveLength(5);
    expect(host.querySelectorAll(':scope > .qn > .qn-group > .qn-children > *')).toHaveLength(5);
  });

  it('toggles NOT and combinator', () => {
    const { store, host } = setup();
    const notBox = host.querySelector<HTMLInputElement>('.qn-not input')!;
    notBox.checked = true;
    notBox.dispatchEvent(new Event('change'));
    choose(host.querySelector('select.qn-combinator')!, 'or');
    expect(store.getQuery()).toMatchObject({ combinator: 'or', not: true });
  });

  it('follows external store changes and disposes cleanly', () => {
    const { store, host } = setup();
    store.setQuery({ kind: 'group', combinator: 'and', children: [{ kind: 'rule', field: 'age', operator: 'eq', value: 5 }] });
    expect(host.querySelectorAll('.qn-rule')).toHaveLength(1);
    expect(host.querySelector<HTMLInputElement>('input.qn-value')!.value).toBe('5');
    store.setQuery({ kind: 'group', combinator: 'and', children: [{ kind: 'group', combinator: 'or', children: [] }] });
    expect(host.querySelectorAll('.qn-group')).toHaveLength(2);
    dispose();
    expect(host.innerHTML).toBe('');
    dispose = () => {};
  });
});
