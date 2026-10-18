import { builtinFunctions, createQueryStore, defineFields, f, type QueryOf } from '@trawlnet/core';
import { flushSync, mount, unmount } from 'svelte';
import { afterEach, describe, expect, it } from 'vitest';
import { QueryBuilder } from '../src/index';

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

const mounted: ReturnType<typeof mount>[] = [];
afterEach(() => {
  mounted.splice(0).forEach((c) => unmount(c));
  document.body.innerHTML = '';
});
const render = (props: Record<string, unknown>) => {
  const target = document.createElement('div');
  document.body.append(target);
  mounted.push(mount(QueryBuilder, { target, props }));
  flushSync();
  return target;
};
// Like a user: interacting with a control (focus) before changing it, which also expands lazy selects.
const focus = (el: Element) => {
  el.dispatchEvent(new FocusEvent('focus'));
  flushSync();
};
const change = (el: HTMLInputElement | HTMLSelectElement, value: string) => {
  focus(el);
  el.value = value;
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  flushSync();
};
const click = (el: HTMLElement) => {
  el.click();
  flushSync();
};

describe('Svelte parity UI', () => {
  it('groups struct fields, hides array fields from rule pickers, and indents tree options', () => {
    const host = render({ fields, initial });
    const fieldSelect = host.querySelector<HTMLSelectElement>('select.tn-field')!;
    // Lazy until the user reaches for it: only the chosen option is in the DOM.
    expect([...fieldSelect.options].map((o) => o.value)).toEqual(['name']);
    focus(fieldSelect);
    expect(fieldSelect.value).toBe('name');
    expect([...fieldSelect.querySelectorAll('optgroup')].map((g) => g.label)).toEqual(['Address']);
    expect([...fieldSelect.options].map((o) => o.value)).not.toContain('orders');
    change(fieldSelect, 'region');
    const region = host.querySelector<HTMLSelectElement>('.tn-rule select.tn-value')!;
    expect([...region.options].map((o) => o.value)).toEqual(['']);
    focus(region);
    expect([...region.options].map((o) => [o.textContent, o.disabled])).toEqual([
      ['—', false],
      ['EMEA', true],
      ['  Germany', false],
    ]);
  });

  it('renders array groups with a scoped field picker and an editable quantifier', () => {
    const store = createQueryStore({ fields, initial });
    const host = render({ store });
    const arrayGroup = host.querySelector('.tn-array-group')!;
    expect(arrayGroup.textContent).toContain('of Orders where');
    const scoped = arrayGroup.querySelector<HTMLSelectElement>('select.tn-field')!;
    focus(scoped);
    expect([...scoped.options].map((o) => o.value)).toEqual(['product', 'qty']);
    change(arrayGroup.querySelector('select.tn-match-mode')!, 'count');
    change(arrayGroup.querySelector('input.tn-match-count')!, '3');
    expect(store.getQuery().children[1]).toMatchObject({ of: { field: 'orders', match: { count: 'gte', value: 3 } } });
    change(host.querySelector('select.tn-add-array')!, 'orders');
    expect(store.getQuery().children[2]).toMatchObject({ of: { field: 'orders', match: 'some' } });
  });

  it('switches the right side between value, field and function', () => {
    const store = createQueryStore({ fields, initial });
    const host = render({ store });
    const rule = host.querySelector('.tn-rule')!;
    change(rule.querySelector('select.tn-source')!, 'function');
    expect(store.getQuery().children[0]).toMatchObject({ field: 'name', call: { fn: 'lower' } });
    change(rule.querySelector('select.tn-function-name')!, 'upper');
    change(rule.querySelector('.tn-function-arg input')!, 'ada');
    expect(store.getQuery().children[0]).toMatchObject({ call: { fn: 'upper', args: { text: { value: 'ada' } } } });
    click(rule.querySelector<HTMLButtonElement>('button.tn-lhs-toggle')!);
    expect(store.getQuery().children[0]).toMatchObject({ field: { fn: 'lower' } });
  });

  it('disables controls for locked nodes and read-only stores, live', () => {
    const store = createQueryStore({ fields, initial });
    const host = render({ store, showLock: true });
    click(host.querySelector<HTMLButtonElement>('.tn-rule button[title="Lock"]')!);
    expect(host.querySelector<HTMLSelectElement>('.tn-rule select.tn-field')!.disabled).toBe(true);
    expect(host.querySelector('.tn-rule')!.classList.contains('tn-locked')).toBe(true);
    store.setSettings({ readOnly: true });
    flushSync();
    expect([...host.querySelectorAll<HTMLButtonElement>('.tn-group-header button')].every((b) => b.disabled)).toBe(true);
  });

  it('disables + Rule at maxRules', () => {
    const store = createQueryStore({ fields, initial, settings: { maxRules: 3 } });
    const host = render({ store });
    const add = [...host.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === '+ Rule')!;
    expect(add.disabled).toBe(false);
    click(add);
    expect(add.disabled).toBe(true);
    expect(host.querySelectorAll('.tn-rule')).toHaveLength(3);
  });

  it('renders only chosen options until a select is hovered, pressed or focused', () => {
    const host = render({ fields, initial });
    const rule = host.querySelector('.tn-rule')!;
    const op = rule.querySelector<HTMLSelectElement>('select.tn-operator')!;
    const source = rule.querySelector<HTMLSelectElement>('select.tn-source')!;
    expect([...op.options].map((o) => o.value)).toEqual(['eq']);
    expect([...source.options].map((o) => o.value)).toEqual(['value']);
    // No flushSync here: the expansion must land in the DOM inside the event itself.
    op.dispatchEvent(new MouseEvent('mouseenter'));
    expect(op.options.length).toBeGreaterThan(1);
    expect(op.value).toBe('eq');
    source.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    expect([...source.options].map((o) => o.value)).toEqual(['value', 'field', 'function']);
    expect(source.value).toBe('value');
  });

  it('updates offered value sources live when allowRefs / allowFunctions change', () => {
    const store = createQueryStore({ fields, initial });
    const host = render({ store });
    const sourceOptions = () => {
      const sel = host.querySelector<HTMLSelectElement>('.tn-rule select.tn-source');
      if (!sel) return null;
      focus(sel);
      return [...sel.options].map((o) => o.value);
    };
    expect(sourceOptions()).toEqual(['value', 'field', 'function']);
    store.setSettings({ allowFunctions: false });
    flushSync();
    expect(sourceOptions()).toEqual(['value', 'field']);
    store.setSettings({ allowRefs: false });
    flushSync();
    expect(sourceOptions()).toBeNull();
  });

  it('hides NOT with showNot: false', () => {
    const host = render({ fields, initial, showNot: false });
    expect(host.querySelector('.tn-not')).toBeNull();
  });
});
