// @vitest-environment jsdom
import { builtinFunctions, createQueryStore, defineFields, f, type QueryOf } from '@qnot/core';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { QueryBuilder } from './index';

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

afterEach(cleanup);

// Like a user: interacting with a control (focus) before changing it, which also expands lazy selects.
function change(el: Element, init: { target: { value: string } }) {
  fireEvent.focus(el);
  fireEvent.change(el, init);
}

describe('parity UI', () => {
  it('groups struct fields, hides array fields from rule pickers, and indents tree options', () => {
    const { container } = render(<QueryBuilder fields={fields} initial={initial} />);
    const fieldSelect = container.querySelector<HTMLSelectElement>('select.qn-field')!;
    // Lazy until the user reaches for it: only the chosen option is in the DOM.
    expect([...fieldSelect.options].map((o) => o.value)).toEqual(['name']);
    fireEvent.focus(fieldSelect);
    expect([...fieldSelect.querySelectorAll('optgroup')].map((g) => g.label)).toEqual(['Address']);
    expect([...fieldSelect.options].map((o) => o.value)).not.toContain('orders');
    change(fieldSelect, { target: { value: 'region' } });
    const region = container.querySelector<HTMLSelectElement>('.qn-rule select.qn-value')!;
    fireEvent.focus(region);
    expect([...region.options].map((o) => [o.textContent, o.disabled])).toEqual([
      ['—', false],
      ['EMEA', true],
      ['  Germany', false],
    ]);
  });

  it('renders array groups with a scoped field picker and an editable quantifier', () => {
    const store = createQueryStore({ fields, initial });
    const { container } = render(<QueryBuilder store={store} />);
    const arrayGroup = container.querySelector('.qn-array-group')!;
    expect(arrayGroup.textContent).toContain('of Orders where');
    const scoped = arrayGroup.querySelector<HTMLSelectElement>('select.qn-field')!;
    fireEvent.focus(scoped);
    expect([...scoped.options].map((o) => o.value)).toEqual(['product', 'qty']);
    change(arrayGroup.querySelector('select.qn-match-mode')!, { target: { value: 'count' } });
    change(arrayGroup.querySelector('input.qn-match-count')!, { target: { value: '3' } });
    expect(store.getQuery().children[1]).toMatchObject({ of: { field: 'orders', match: { count: 'gte', value: 3 } } });
    change(container.querySelector('select.qn-add-array')!, { target: { value: 'orders' } });
    expect(store.getQuery().children[2]).toMatchObject({ of: { field: 'orders', match: 'some' } });
  });

  it('switches the right side between value, field and function', () => {
    const store = createQueryStore({ fields, initial });
    const { container } = render(<QueryBuilder store={store} />);
    const rule = container.querySelector('.qn-rule')!;
    change(rule.querySelector('select.qn-source')!, { target: { value: 'function' } });
    expect(store.getQuery().children[0]).toMatchObject({ field: 'name', call: { fn: 'lower' } });
    change(rule.querySelector('select.qn-function-name')!, { target: { value: 'upper' } });
    change(rule.querySelector('.qn-function-arg input')!, { target: { value: 'ada' } });
    expect(store.getQuery().children[0]).toMatchObject({ call: { fn: 'upper', args: { text: { value: 'ada' } } } });
    fireEvent.click(rule.querySelector('button.qn-lhs-toggle')!);
    expect(store.getQuery().children[0]).toMatchObject({ field: { fn: 'lower' } });
  });

  it('disables controls for locked nodes and read-only stores, live', () => {
    const store = createQueryStore({ fields, initial });
    const { container } = render(<QueryBuilder store={store} showLock />);
    const lock = container.querySelector<HTMLButtonElement>('.qn-rule button[title="Lock"]')!;
    fireEvent.click(lock);
    expect(container.querySelector<HTMLSelectElement>('.qn-rule select.qn-field')!.disabled).toBe(true);
    expect(container.querySelector('.qn-rule')!.classList.contains('qn-locked')).toBe(true);
    act(() => store.setSettings({ readOnly: true }));
    expect([...container.querySelectorAll<HTMLButtonElement>('.qn-group-header button')].every((b) => b.disabled)).toBe(true);
  });

  it('disables + Rule at maxRules', () => {
    const store = createQueryStore({ fields, initial, settings: { maxRules: 3 } });
    const { container, getAllByText } = render(<QueryBuilder store={store} />);
    const add = getAllByText('+ Rule')[0] as HTMLButtonElement;
    expect(add.disabled).toBe(false);
    fireEvent.click(add);
    expect(add.disabled).toBe(true);
    expect(container.querySelectorAll('.qn-rule')).toHaveLength(3);
  });
});

describe('async search input', () => {
  it('follows external value changes without clobbering typed text', () => {
    const cities = defineFields({
      city: f.enum(['berlin', 'paris'], { allowCustom: true, search: async () => [{ value: 'paris' as const, label: 'Paris' }] }),
    });
    const store = createQueryStore({ fields: cities, initial: { kind: 'group', combinator: 'and', children: [{ kind: 'rule', field: 'city', operator: 'eq', value: 'berlin' }] } });
    const id = store.getGroup(store.rootId).children[0]!;
    const { container } = render(<QueryBuilder store={store} />);
    const input = () => container.querySelector<HTMLInputElement>('.qn-rule input[list]')!;
    expect(input().value).toBe('berlin');
    act(() => store.setRuleValue(id, 'paris'));
    expect(input().value).toBe('paris');
    change(input(), { target: { value: 'pa' } });
    expect(store.getRule(id)).toMatchObject({ value: 'pa' });
    expect(input().value).toBe('pa');
    act(() => void store.undo());
    expect(input().value).toBe('berlin');
  });

  it('updates offered value sources live when allowRefs / allowFunctions change', () => {
    const store = createQueryStore({ fields, initial });
    const { container } = render(<QueryBuilder store={store} />);
    const sourceOptions = () => {
      const select = container.querySelector<HTMLSelectElement>('.qn-rule select.qn-source')!;
      fireEvent.focus(select);
      return [...select.options].map((o) => o.value);
    };
    expect(sourceOptions()).toEqual(['value', 'field', 'function']);
    act(() => store.setSettings({ allowFunctions: false }));
    expect(sourceOptions()).toEqual(['value', 'field']);
    act(() => store.setSettings({ allowRefs: false }));
    expect(container.querySelector('.qn-rule select.qn-source')).toBeNull();
  });
});
