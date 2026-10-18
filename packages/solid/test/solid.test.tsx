/** @jsxImportSource solid-js */
import { createQueryStore, defineFields, f, type QueryOf } from '@trawlnet/core';
import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, describe, expect, it } from 'vitest';
import { QueryBuilder, useRule } from '../src/index';

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

const disposers: (() => void)[] = [];
afterEach(() => {
  disposers.splice(0).forEach((d) => d());
  document.body.innerHTML = '';
});
const mountIt = (ui: () => any) => {
  const host = document.createElement('div');
  document.body.append(host);
  disposers.push(render(ui, host));
  return host;
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

describe('Solid <QueryBuilder>', () => {
  it('renders, edits and reports changes', () => {
    const changes: Q[] = [];
    const host = mountIt(() => <QueryBuilder<Q> fields={fields} initial={initial} onChange={(v) => changes.push(v)} />);
    expect(host.querySelectorAll('.tn-rule')).toHaveLength(3);
    type(host.querySelector('input.tn-value[type="text"]')!, 'Grace');
    expect(changes.at(-1)!.children[0]).toEqual({ kind: 'rule', field: 'name', operator: 'eq', value: 'Grace' });
  });

  it('updates only the edited rule', () => {
    const store = createQueryStore({ fields, initial });
    const runs = new Map<string, number>();
    function CountingRule(props: { id: string }) {
      const r = useRule(props.id);
      return (
        <input
          class="counting"
          value={(() => {
            runs.set(props.id, (runs.get(props.id) ?? 0) + 1);
            return String(r.value() ?? '');
          })()}
          onInput={(e) => r.setValue(e.currentTarget.value)}
        />
      );
    }
    const host = mountIt(() => <QueryBuilder store={store} components={{ Rule: CountingRule }} />);
    const [a, b, c] = store.getGroup(store.rootId).children;
    runs.clear();
    type(host.querySelector<HTMLInputElement>('input.counting')!, 'Grace');
    expect(runs.get(a!)).toBe(1);
    expect(runs.get(b!)).toBeUndefined();
    expect(runs.get(c!)).toBeUndefined();
  });

  it('works controlled, including external changes', () => {
    const [q, setQ] = createSignal<Q>(initial);
    const host = mountIt(() => <QueryBuilder<Q> fields={fields} value={q()} onChange={setQ} />);
    type(host.querySelector('input.tn-value[type="number"]')!, '41');
    expect(q().children[1]).toEqual({ kind: 'rule', field: 'age', operator: 'gt', value: 41 });
    setQ({ ...q(), children: q().children.slice(1) });
    expect(host.querySelectorAll('.tn-rule')).toHaveLength(2);
  });

  it('adds groups/rules, switches operators, toggles NOT, follows undo', () => {
    const store = createQueryStore({ fields, initial });
    const host = mountIt(() => <QueryBuilder store={store} />);
    [...host.querySelectorAll('button')].find((b) => b.textContent === '+ Group')!.click();
    expect(host.querySelectorAll('.tn-group')).toHaveLength(2);
    const nested = host.querySelectorAll('.tn-group')[1]!;
    [...nested.querySelectorAll('button')].find((b) => b.textContent === '+ Rule')!.click();
    // New groups start with one rule (RAQB default), so this is the second.
    expect(store.getQuery().children[3]).toMatchObject({ kind: 'group', children: [{ kind: 'rule', field: 'name' }, { kind: 'rule', field: 'name' }] });
    choose(host.querySelectorAll<HTMLSelectElement>('select.tn-operator')[1]!, 'between');
    expect(host.querySelectorAll('.tn-value-pair input')).toHaveLength(2);
    const notBox = host.querySelector<HTMLInputElement>('.tn-not input')!;
    notBox.checked = true;
    notBox.dispatchEvent(new Event('change', { bubbles: true }));
    expect(store.getQuery().not).toBe(true);
    store.undo();
    store.undo();
    expect(host.querySelectorAll('.tn-value-pair')).toHaveLength(0);
  });
});
