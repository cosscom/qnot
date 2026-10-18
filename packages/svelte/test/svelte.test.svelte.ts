import { createQueryStore, defineFields, f, type QueryOf } from '@trawlnet/core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { QueryBuilder } from '../src/index';
import CountingRule from './CountingRule.svelte';
import { counts } from './counts';
import Harness from './Harness.svelte';

const fields = defineFields({ name: f.text(), age: f.number(), status: f.enum(['active', 'banned']) });
type Q = QueryOf<typeof fields>;
const initial: Q = {
  kind: 'group',
  combinator: 'and',
  children: [
    { kind: 'rule', field: 'name', operator: 'eq', value: 'Ada' },
    { kind: 'rule', field: 'age', operator: 'gt', value: 30 },
    { kind: 'rule', field: 'status', operator: 'eq', value: 'active' },
  ],
};

const mounted: ReturnType<typeof mount>[] = [];
afterEach(() => {
  mounted.splice(0).forEach((c) => unmount(c));
  document.body.innerHTML = '';
});
const render = (component: any, props: Record<string, unknown>) => {
  const target = document.createElement('div');
  document.body.append(target);
  mounted.push(mount(component, { target, props }));
  flushSync();
  return target;
};
const type = (el: HTMLInputElement, value: string) => {
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  flushSync();
};
const choose = (el: HTMLSelectElement, value: string) => {
  el.value = value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
  flushSync();
};

describe('Svelte <QueryBuilder>', () => {
  it('renders, edits and reports changes', () => {
    const changes: Q[] = [];
    const host = render(QueryBuilder, { fields, initial, onchange: (v: Q) => changes.push(v) });
    expect(host.querySelectorAll('.tn-rule')).toHaveLength(3);
    type(host.querySelector('input.tn-value[type="text"]')!, 'Grace');
    expect(changes.at(-1)!.children[0]).toEqual({ kind: 'rule', field: 'name', operator: 'eq', value: 'Grace' });
  });

  it('updates only the edited rule', () => {
    const store = createQueryStore({ fields, initial });
    const host = render(QueryBuilder, { store, components: { Rule: CountingRule } });
    const [a, b, c] = store.getGroup(store.rootId).children;
    counts.clear();
    const rows = [...host.querySelectorAll('input.counting')];
    type(rows[0] as HTMLInputElement, 'Grace');
    expect(counts.get(a!)).toBe(1);
    expect(counts.get(b!)).toBeUndefined();
    expect(counts.get(c!)).toBeUndefined();
    expect([...host.querySelectorAll('input.counting')]).toEqual(rows);
  });

  it('supports bind:value and external changes', () => {
    const host = render(Harness, { fields, value: initial });
    type(host.querySelector('input.tn-value[type="number"]')!, '41');
    expect(JSON.parse(host.querySelector('pre')!.textContent!).children[1]).toEqual({ kind: 'rule', field: 'age', operator: 'gt', value: 41 });
  });

  it('adds groups/rules, switches operators, toggles NOT, follows undo', () => {
    const store = createQueryStore({ fields, initial });
    const host = render(QueryBuilder, { store });
    [...host.querySelectorAll('button')].find((b) => b.textContent === '+ Group')!.click();
    flushSync();
    expect(host.querySelectorAll('.tn-group')).toHaveLength(2);
    const nested = host.querySelectorAll('.tn-group')[1]!;
    [...nested.querySelectorAll('button')].find((b) => b.textContent === '+ Rule')!.click();
    flushSync();
    // New groups start with one rule (RAQB default), so this is the second.
    expect(store.getQuery().children[3]).toMatchObject({ kind: 'group', children: [{ kind: 'rule', field: 'name' }, { kind: 'rule', field: 'name' }] });
    choose(host.querySelectorAll<HTMLSelectElement>('select.tn-operator')[1]!, 'between');
    expect(host.querySelectorAll('.tn-value-pair input')).toHaveLength(2);
    const notBox = host.querySelector<HTMLInputElement>('.tn-not input')!;
    notBox.checked = true;
    notBox.dispatchEvent(new Event('change', { bubbles: true }));
    flushSync();
    expect(store.getQuery().not).toBe(true);
    store.undo();
    store.undo();
    flushSync();
    expect(host.querySelectorAll('.tn-value-pair')).toHaveLength(0);
  });
});

describe('Svelte controlled mode', () => {
  it('applies external value changes without echoing into history', () => {
    const target = document.createElement('div');
    document.body.append(target);
    const props = $state({ fields, value: initial });
    mounted.push(mount(Harness, { target, props }));
    flushSync();
    expect(target.querySelectorAll('.tn-rule')).toHaveLength(3);
    props.value = { ...initial, children: initial.children.slice(1) };
    flushSync();
    expect(target.querySelectorAll('.tn-rule')).toHaveLength(2);
    type(target.querySelector('input.tn-value[type="number"]')!, '7');
    expect(JSON.parse(target.querySelector('pre')!.textContent!).children[0]).toEqual({ kind: 'rule', field: 'age', operator: 'gt', value: 7 });
  });
});
