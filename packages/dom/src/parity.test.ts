// @vitest-environment jsdom
import { builtinFunctions, createQueryStore, defineFields, f, type QueryOf } from '@qnot/core';
import { afterEach, describe, expect, it } from 'vitest';
import { mountQueryBuilder, type MountOptions } from './index';

const fields = defineFields(
  {
    name: f.text(),
    lastSeen: f.datetime(),
    region: f.enum([{ value: 'emea', label: 'EMEA', children: [{ value: 'de', label: 'Germany' }] }], { leafOnly: true }),
    address: f.struct({ city: f.text() }, { label: 'Address' }),
    orders: f.array({ product: f.text(), qty: f.number() }),
  },
  { functions: builtinFunctions },
);
type Q = QueryOf<typeof fields>;
const initial: Q = {
  kind: 'group',
  combinator: 'and',
  children: [
    { kind: 'rule', field: 'name', operator: 'eq', value: 'Ada' },
    { kind: 'group', combinator: 'and', of: { field: 'orders', match: 'some' }, children: [{ kind: 'rule', field: 'qty', operator: 'gt', value: 2 }] },
  ],
};

let dispose = () => {};
afterEach(() => {
  dispose();
  document.body.innerHTML = '';
});
const setup = (opts: { settings?: object; mount?: MountOptions } = {}) => {
  const store = createQueryStore({ fields, initial, ...(opts.settings && { settings: opts.settings }) });
  const host = document.createElement('div');
  document.body.append(host);
  dispose = mountQueryBuilder(host, store, opts.mount);
  return { store, host };
};
// Like a user: interacting with a control (focus) before changing it, which also expands lazy selects.
const focus = (el: Element) => el.dispatchEvent(new FocusEvent('focus'));
const change = (el: HTMLInputElement | HTMLSelectElement, value: string) => {
  focus(el);
  el.value = value;
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
};

describe('dom parity UI', () => {
  it('groups struct fields, hides array fields from rule pickers, and indents tree options', () => {
    const { host } = setup();
    const fieldSelect = host.querySelector<HTMLSelectElement>('select.qn-field')!;
    // Lazy until the user reaches for it: only the chosen option is in the DOM.
    expect([...fieldSelect.options].map((o) => o.value)).toEqual(['name']);
    focus(fieldSelect);
    expect(fieldSelect.value).toBe('name');
    expect([...fieldSelect.querySelectorAll('optgroup')].map((g) => g.label)).toEqual(['Address']);
    expect([...fieldSelect.options].map((o) => o.value)).not.toContain('orders');
    change(fieldSelect, 'region');
    const region = host.querySelector<HTMLSelectElement>('.qn-rule select.qn-value')!;
    expect([...region.options].map((o) => o.value)).toEqual(['']);
    focus(region);
    expect([...region.options].map((o) => [o.textContent, o.disabled])).toEqual([
      ['—', false],
      ['EMEA', true],
      ['  Germany', false],
    ]);
  });

  it('renders array groups with a scoped field picker and an editable quantifier', () => {
    const { store, host } = setup();
    const arrayGroup = host.querySelector('.qn-array-group')!;
    expect(arrayGroup.textContent).toContain('of Orders where');
    const scoped = arrayGroup.querySelector<HTMLSelectElement>('select.qn-field')!;
    focus(scoped);
    expect([...scoped.options].map((o) => o.value)).toEqual(['product', 'qty']);
    change(arrayGroup.querySelector('select.qn-match-mode')!, 'count');
    change(arrayGroup.querySelector('input.qn-match-count')!, '3');
    expect(store.getQuery().children[1]).toMatchObject({ of: { field: 'orders', match: { count: 'gte', value: 3 } } });
    change(host.querySelector('select.qn-add-array')!, 'orders');
    expect(store.getQuery().children[2]).toMatchObject({ of: { field: 'orders', match: 'some' } });
  });

  it('switches the right side between value, field and function', () => {
    const { store, host } = setup();
    const rule = host.querySelector('.qn-rule')!;
    change(rule.querySelector('select.qn-source')!, 'function');
    expect(store.getQuery().children[0]).toMatchObject({ field: 'name', call: { fn: 'lower' } });
    change(rule.querySelector('select.qn-function-name')!, 'upper');
    change(rule.querySelector('.qn-function-arg input')!, 'ada');
    expect(store.getQuery().children[0]).toMatchObject({ call: { fn: 'upper', args: { text: { value: 'ada' } } } });
    rule.querySelector<HTMLButtonElement>('button.qn-lhs-toggle')!.click();
    expect(store.getQuery().children[0]).toMatchObject({ field: { fn: 'lower' } });
  });

  it('disables controls for locked nodes and read-only stores, live', () => {
    const { store, host } = setup({ mount: { showLock: true } });
    host.querySelector<HTMLButtonElement>('.qn-rule button[title="Lock"]')!.click();
    expect(host.querySelector<HTMLSelectElement>('.qn-rule select.qn-field')!.disabled).toBe(true);
    expect(host.querySelector('.qn-rule')!.classList.contains('qn-locked')).toBe(true);
    store.setSettings({ readOnly: true });
    expect([...host.querySelectorAll<HTMLButtonElement>('.qn-group-header button')].every((b) => b.disabled)).toBe(true);
  });

  it('disables + Rule at maxRules', () => {
    const { host } = setup({ settings: { maxRules: 3 } });
    const add = [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === '+ Rule')!;
    expect(add.disabled).toBe(false);
    add.click();
    expect(add.disabled).toBe(true);
    expect(host.querySelectorAll('.qn-rule')).toHaveLength(3);
  });

  it('renders only chosen options until a select is hovered, pressed or focused', () => {
    const { host } = setup();
    const rule = host.querySelector('.qn-rule')!;
    const op = rule.querySelector<HTMLSelectElement>('select.qn-operator')!;
    const source = rule.querySelector<HTMLSelectElement>('select.qn-source')!;
    expect([...op.options].map((o) => o.value)).toEqual(['eq']);
    expect([...source.options].map((o) => o.value)).toEqual(['value']);
    op.dispatchEvent(new MouseEvent('mouseenter'));
    expect(op.options.length).toBeGreaterThan(1);
    expect(op.value).toBe('eq');
    source.dispatchEvent(new Event('pointerdown'));
    expect([...source.options].map((o) => o.value)).toEqual(['value', 'field', 'function']);
    expect(source.value).toBe('value');
  });

  it('updates offered value sources live when allowRefs / allowFunctions change', () => {
    const { store, host } = setup();
    const sourceOptions = () => {
      const sel = host.querySelector<HTMLSelectElement>('.qn-rule select.qn-source');
      if (!sel) return null;
      focus(sel);
      return [...sel.options].map((o) => o.value);
    };
    expect(sourceOptions()).toEqual(['value', 'field', 'function']);
    store.setSettings({ allowFunctions: false });
    expect(sourceOptions()).toEqual(['value', 'field']);
    store.setSettings({ allowRefs: false });
    expect(sourceOptions()).toBeNull();
  });

  it('hides NOT with showNot: false', () => {
    const { host } = setup({ mount: { showNot: false } });
    expect(host.querySelector('.qn-not')).toBeNull();
  });
});
