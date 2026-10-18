// @vitest-environment jsdom
import { createQueryStore, defineFields, f, type QueryOf } from '@trawlnet/core';
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
    expect(host.querySelectorAll('.tn-rule')).toHaveLength(3);
    type(host.querySelector('input.tn-value[type="text"]')!, 'Grace');
    expect(store.getQuery().children[0]).toEqual({ kind: 'rule', field: 'name', operator: 'eq', value: 'Grace' });
    type(host.querySelector('input.tn-value[type="number"]')!, '41');
    expect(store.getQuery().children[1]).toMatchObject({ value: 41 });
  });

  it('patches only the edited row', () => {
    const { host } = setup();
    const rows = [...host.querySelectorAll('.tn-rule')];
    const siblingControls = [...rows[1]!.querySelectorAll('*'), ...rows[2]!.querySelectorAll('*')];
    const observed: MutationRecord[] = [];
    const mo = new MutationObserver((m) => observed.push(...m));
    mo.observe(host, { subtree: true, childList: true, attributes: true, characterData: true });
    type(rows[0]!.querySelector('input.tn-value')!, 'Grace');
    const records = mo.takeRecords().concat(observed);
    mo.disconnect();
    expect(records.every((r) => !siblingControls.includes(r.target as Element) && !rows.slice(1).includes(r.target as Element))).toBe(true);
    expect([...host.querySelectorAll('.tn-rule')]).toEqual(rows);
  });

  it('switches editors with the operator and keeps draft text', () => {
    const { store, host } = setup();
    const ageRow = host.querySelectorAll('.tn-rule')[1]!;
    choose(ageRow.querySelector('select.tn-operator')!, 'between');
    expect(ageRow.querySelectorAll('.tn-value-pair input')).toHaveLength(2);
    const lo = ageRow.querySelectorAll<HTMLInputElement>('.tn-value-pair input')[0]!;
    expect(lo.value).toBe('30');
    choose(ageRow.querySelector('select.tn-operator')!, 'isNull');
    expect(ageRow.querySelector('.tn-value')).toBeNull();
    choose(ageRow.querySelector('select.tn-operator')!, 'in');
    const list = ageRow.querySelector<HTMLInputElement>('input.tn-value')!;
    type(list, '1, 2, ');
    expect(store.getRule(store.getGroup(store.rootId).children[1]!)).toMatchObject({ value: [1, 2] });
    expect(list.value).toBe('1, 2, ');
  });

  it('adds rules and groups, removes and clones', () => {
    const { store, host } = setup();
    const addGroup = [...host.querySelectorAll('button')].find((b) => b.textContent === '+ Group')!;
    addGroup.click();
    expect(host.querySelectorAll('.tn-group')).toHaveLength(2);
    const nested = host.querySelectorAll('.tn-group')[1]!;
    // New groups start with one rule (RAQB default).
    expect(nested.querySelectorAll('.tn-rule')).toHaveLength(1);
    [...nested.querySelectorAll('button')].find((b) => b.textContent === '+ Rule')!.click();
    expect(nested.querySelectorAll('.tn-rule')).toHaveLength(2);
    expect(store.getQuery().children[3]).toMatchObject({ kind: 'group', children: [{ kind: 'rule', field: 'name' }, { kind: 'rule', field: 'name' }] });
    const first = host.querySelector('.tn-rule')!;
    first.querySelector<HTMLButtonElement>('button[aria-label="Duplicate"]')!.click();
    expect(store.getGroup(store.rootId).children).toHaveLength(5);
    host.querySelector<HTMLButtonElement>('.tn-rule button[aria-label="Remove"]')!.click();
    expect(store.getGroup(store.rootId).children).toHaveLength(4);
    store.undo();
    expect(store.getGroup(store.rootId).children).toHaveLength(5);
    expect(host.querySelectorAll(':scope > .tn > .tn-group > .tn-children > *')).toHaveLength(5);
  });

  it('toggles NOT and combinator', () => {
    const { store, host } = setup();
    const notBox = host.querySelector<HTMLInputElement>('.tn-not input')!;
    notBox.checked = true;
    notBox.dispatchEvent(new Event('change'));
    choose(host.querySelector('select.tn-combinator')!, 'or');
    expect(store.getQuery()).toMatchObject({ combinator: 'or', not: true });
  });

  it('follows external store changes and disposes cleanly', () => {
    const { store, host } = setup();
    store.setQuery({ kind: 'group', combinator: 'and', children: [{ kind: 'rule', field: 'age', operator: 'eq', value: 5 }] });
    expect(host.querySelectorAll('.tn-rule')).toHaveLength(1);
    expect(host.querySelector<HTMLInputElement>('input.tn-value')!.value).toBe('5');
    store.setQuery({ kind: 'group', combinator: 'and', children: [{ kind: 'group', combinator: 'or', children: [] }] });
    expect(host.querySelectorAll('.tn-group')).toHaveLength(2);
    dispose();
    expect(host.innerHTML).toBe('');
    dispose = () => {};
  });
});
