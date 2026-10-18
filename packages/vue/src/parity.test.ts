// @vitest-environment jsdom
import { builtinFunctions, createQueryStore, defineFields, f, type QueryOf } from '@trawlnet/core';
import { mount } from '@vue/test-utils';
import { afterEach, describe, expect, it } from 'vitest';
import { nextTick } from 'vue';
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

const wrappers: { unmount(): void }[] = [];
afterEach(() => wrappers.splice(0).forEach((w) => w.unmount()));
const render = (props: Record<string, unknown>) => {
  const w = mount(QueryBuilder, { props });
  wrappers.push(w);
  return w;
};

describe('Vue parity UI', () => {
  it('groups struct fields, hides array fields from rule pickers, and indents tree options', async () => {
    const w = render({ fields, initial });
    const fieldSelect = w.find('select.tn-field');
    expect(fieldSelect.findAll('optgroup').map((g) => g.attributes('label'))).toEqual(['Address']);
    expect(fieldSelect.findAll('option').map((o) => (o.element as HTMLOptionElement).value)).not.toContain('orders');
    await fieldSelect.setValue('region');
    const region = w.find('.tn-rule select.tn-value').element as HTMLSelectElement;
    expect([...region.options].map((o) => [o.textContent, o.disabled])).toEqual([
      ['—', false],
      ['EMEA', true],
      ['  Germany', false],
    ]);
  });

  it('renders array groups with a scoped field picker and an editable quantifier', async () => {
    const store = createQueryStore({ fields, initial });
    const w = render({ store });
    const arrayGroup = w.find('.tn-array-group');
    expect(arrayGroup.text()).toContain('of Orders where');
    expect(arrayGroup.find('select.tn-field').findAll('option').map((o) => (o.element as HTMLOptionElement).value)).toEqual(['product', 'qty']);
    await arrayGroup.find('select.tn-match-mode').setValue('count');
    await w.find('.tn-array-group input.tn-match-count').setValue('3');
    expect(store.getQuery().children[1]).toMatchObject({ of: { field: 'orders', match: { count: 'gte', value: 3 } } });
    await w.find('select.tn-add-array').setValue('orders');
    expect(store.getQuery().children[2]).toMatchObject({ of: { field: 'orders', match: 'some' } });
  });

  it('switches the right side between value, field and function', async () => {
    const store = createQueryStore({ fields, initial });
    const w = render({ store });
    const rule = () => w.find('.tn-rule');
    await rule().find('select.tn-source').setValue('function');
    expect(store.getQuery().children[0]).toMatchObject({ field: 'name', call: { fn: 'lower' } });
    await rule().find('select.tn-function-name').setValue('upper');
    await rule().find('.tn-function-arg input').setValue('ada');
    expect(store.getQuery().children[0]).toMatchObject({ call: { fn: 'upper', args: { text: { value: 'ada' } } } });
    await rule().find('button.tn-lhs-toggle').trigger('click');
    expect(store.getQuery().children[0]).toMatchObject({ field: { fn: 'lower' } });
  });

  it('disables controls for locked nodes and read-only stores, live', async () => {
    const store = createQueryStore({ fields, initial });
    const w = render({ store, showLock: true });
    await w.find('.tn-rule button[title="Lock"]').trigger('click');
    expect((w.find('.tn-rule select.tn-field').element as HTMLSelectElement).disabled).toBe(true);
    expect(w.find('.tn-rule').classes()).toContain('tn-locked');
    store.setSettings({ readOnly: true });
    await nextTick();
    expect(w.findAll('.tn-group-header button').every((b) => (b.element as HTMLButtonElement).disabled)).toBe(true);
  });

  it('disables + Rule at maxRules', async () => {
    const store = createQueryStore({ fields, initial, settings: { maxRules: 3 } });
    const w = render({ store });
    const add = () => w.findAll('button').find((b) => b.text() === '+ Rule')!;
    expect((add().element as HTMLButtonElement).disabled).toBe(false);
    await add().trigger('click');
    expect((add().element as HTMLButtonElement).disabled).toBe(true);
    expect(w.findAll('.tn-rule')).toHaveLength(3);
  });

  it('hides NOT with showNot: false', () => {
    const w = render({ fields, initial, showNot: false });
    expect(w.find('.tn-not').exists()).toBe(false);
  });
});
