// @vitest-environment jsdom
import { builtinFunctions, createQueryStore, defineFields, f, type QueryOf } from '@qnot/core';
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

// Like a user: interacting with a control (focus) before changing it, which also expands lazy selects.
async function change(w: { trigger(e: string): Promise<void>; setValue(v: unknown): Promise<void> }, value: unknown) {
  await w.trigger('focus');
  await w.setValue(value);
}

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
    const fieldSelect = w.find('select.qn-field');
    // Lazy until the user reaches for it: only the chosen option is in the DOM.
    expect([...(fieldSelect.element as HTMLSelectElement).options].map((o) => o.value)).toEqual(['name']);
    await fieldSelect.trigger('focus');
    expect((fieldSelect.element as HTMLSelectElement).value).toBe('name');
    expect(fieldSelect.findAll('optgroup').map((g) => g.attributes('label'))).toEqual(['Address']);
    expect(fieldSelect.findAll('option').map((o) => (o.element as HTMLOptionElement).value)).not.toContain('orders');
    await change(fieldSelect, 'region');
    const region = w.find('.qn-rule select.qn-value').element as HTMLSelectElement;
    expect([...region.options].map((o) => o.value)).toEqual(['']);
    await w.find('.qn-rule select.qn-value').trigger('focus');
    expect([...region.options].map((o) => [o.textContent, o.disabled])).toEqual([
      ['—', false],
      ['EMEA', true],
      ['  Germany', false],
    ]);
  });

  it('renders array groups with a scoped field picker and an editable quantifier', async () => {
    const store = createQueryStore({ fields, initial });
    const w = render({ store });
    const arrayGroup = w.find('.qn-array-group');
    expect(arrayGroup.text()).toContain('of Orders where');
    await arrayGroup.find('select.qn-field').trigger('focus');
    expect(arrayGroup.find('select.qn-field').findAll('option').map((o) => (o.element as HTMLOptionElement).value)).toEqual(['product', 'qty']);
    await change(arrayGroup.find('select.qn-match-mode'), 'count');
    await change(w.find('.qn-array-group input.qn-match-count'), '3');
    expect(store.getQuery().children[1]).toMatchObject({ of: { field: 'orders', match: { count: 'gte', value: 3 } } });
    await change(w.find('select.qn-add-array'), 'orders');
    expect(store.getQuery().children[2]).toMatchObject({ of: { field: 'orders', match: 'some' } });
  });

  it('switches the right side between value, field and function', async () => {
    const store = createQueryStore({ fields, initial });
    const w = render({ store });
    const rule = () => w.find('.qn-rule');
    await change(rule().find('select.qn-source'), 'function');
    expect(store.getQuery().children[0]).toMatchObject({ field: 'name', call: { fn: 'lower' } });
    await change(rule().find('select.qn-function-name'), 'upper');
    await change(rule().find('.qn-function-arg input'), 'ada');
    expect(store.getQuery().children[0]).toMatchObject({ call: { fn: 'upper', args: { text: { value: 'ada' } } } });
    await rule().find('button.qn-lhs-toggle').trigger('click');
    expect(store.getQuery().children[0]).toMatchObject({ field: { fn: 'lower' } });
  });

  it('disables controls for locked nodes and read-only stores, live', async () => {
    const store = createQueryStore({ fields, initial });
    const w = render({ store, showLock: true });
    await w.find('.qn-rule button[title="Lock"]').trigger('click');
    expect((w.find('.qn-rule select.qn-field').element as HTMLSelectElement).disabled).toBe(true);
    expect(w.find('.qn-rule').classes()).toContain('qn-locked');
    store.setSettings({ readOnly: true });
    await nextTick();
    expect(w.findAll('.qn-group-header button').every((b) => (b.element as HTMLButtonElement).disabled)).toBe(true);
  });

  it('disables + Rule at maxRules', async () => {
    const store = createQueryStore({ fields, initial, settings: { maxRules: 3 } });
    const w = render({ store });
    const add = () => w.findAll('button').find((b) => b.text() === '+ Rule')!;
    expect((add().element as HTMLButtonElement).disabled).toBe(false);
    await add().trigger('click');
    expect((add().element as HTMLButtonElement).disabled).toBe(true);
    expect(w.findAll('.qn-rule')).toHaveLength(3);
  });

  it('renders only chosen options until a select is hovered, pressed or focused', async () => {
    const w = render({ fields, initial });
    const op = w.find('.qn-rule select.qn-operator');
    const source = w.find('.qn-rule select.qn-source');
    const values = (x: typeof op) => [...(x.element as HTMLSelectElement).options].map((o) => o.value);
    expect(values(op)).toEqual(['eq']);
    expect(values(source)).toEqual(['value']);
    await op.trigger('mouseenter');
    expect(values(op).length).toBeGreaterThan(1);
    expect((op.element as HTMLSelectElement).value).toBe('eq');
    // Expansion lands in the DOM inside the event, not on the next render.
    source.element.dispatchEvent(new Event('pointerdown'));
    expect(values(source)).toEqual(['value', 'field', 'function']);
    expect((source.element as HTMLSelectElement).value).toBe('value');
  });

  it('updates offered value sources live when allowRefs / allowFunctions change', async () => {
    const store = createQueryStore({ fields, initial });
    const w = render({ store });
    const sourceOptions = async () => {
      const sel = w.find('.qn-rule select.qn-source');
      if (!sel.exists()) return null;
      await sel.trigger('focus');
      return [...(sel.element as HTMLSelectElement).options].map((o) => o.value);
    };
    expect(await sourceOptions()).toEqual(['value', 'field', 'function']);
    store.setSettings({ allowFunctions: false });
    await nextTick();
    expect(await sourceOptions()).toEqual(['value', 'field']);
    store.setSettings({ allowRefs: false });
    await nextTick();
    expect(await sourceOptions()).toBeNull();
  });

  it('hides NOT with showNot: false', () => {
    const w = render({ fields, initial, showNot: false });
    expect(w.find('.qn-not').exists()).toBe(false);
  });
});
