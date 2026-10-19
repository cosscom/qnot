// Shared by every qnot binding: the same fields, stored query, store and DOM selectors (all bindings
// render the same classes), so the only difference between them is the renderer.
import '@qnot/core/styles.css';
import { createQueryStore, defineFields, encode, f, type Fields, type Query, type QueryStore } from '@qnot/core';
import { sql } from '@qnot/core/formats/sql';
import { FIELDS, makeTree, isGroup, pickNative, html5Drag, type Adapter, type CGroup } from '../shared';

export const fields: Fields = defineFields(
  Object.fromEntries(
    FIELDS.map((d) => [
      d.name,
      d.type === 'text' ? f.text({ label: d.label }) : d.type === 'number' ? f.number({ label: d.label }) : d.type === 'select' ? f.enum(d.options!, { label: d.label }) : f.boolean({ label: d.label }),
    ]),
  ),
);

const toNative = (g: CGroup): Query => ({
  kind: 'group',
  combinator: g.combinator,
  children: g.rules.map((r) => (isGroup(r) ? toNative(r) : { kind: 'rule', field: r.field, operator: 'eq', value: r.value })),
});

const rows = (el: HTMLElement) => el.querySelectorAll<HTMLElement>('.qn-rule');
const fieldOf = (row: Element | undefined) => row?.querySelector<HTMLSelectElement>('select.qn-field')?.value;

/** `render` mounts the binding's <QueryBuilder> for `store` into `el` and returns its unmount. */
export function qnotAdapter(name: string, render: (el: HTMLElement, store: QueryStore<any, any>) => () => void): Adapter {
  let prepared: Query;
  let store: QueryStore<any, any>;
  let dispose: (() => void) | null = null;
  return {
    name,
    prepare(n) {
      prepared = JSON.parse(JSON.stringify(toNative(makeTree(n))));
    },
    mount(el) {
      store = createQueryStore({ fields, initial: prepared });
      dispose = render(el, store);
    },
    unmount() {
      dispose?.();
      dispose = null;
    },
    ruleCount: (el) => rows(el).length,
    textInputs: (el) => Array.from(el.querySelectorAll<HTMLInputElement>('.qn-rule input.qn-value[type="text"]')),
    addRule: (el) => {
      const header = el.querySelector('.qn > .qn-group > .qn-group-header')!;
      Array.from(header.querySelectorAll('button')).find((b) => b.textContent === '+ Rule')!.click();
    },
    removeRule: (el, i) => rows(el)[i]!.querySelector<HTMLButtonElement>('button[aria-label="Remove"]')!.click(),
    async changeField(el, i, to) {
      await pickNative(rows(el)[i]!.querySelector('select.qn-field')!, to.name);
      const type = to.type === 'number' ? 'number' : 'text';
      return () => fieldOf(rows(el)[i]) === to.name && rows(el)[i]!.querySelector<HTMLInputElement>('input.qn-value')?.type === type;
    },
    async changeOperator(el, i, negate) {
      const op = negate ? 'neq' : 'eq';
      await pickNative(rows(el)[i]!.querySelector('select.qn-operator')!, op);
      return () => rows(el)[i]!.querySelector<HTMLSelectElement>('select.qn-operator')!.value === op;
    },
    reorder(el, from) {
      const row = rows(el)[from]!;
      const group = row.closest('.qn-group')!;
      const moved = fieldOf(row);
      html5Drag(row.querySelector('.qn-handle')!, group.querySelector('.qn-rule')!);
      return () => fieldOf(group.querySelector('.qn-rule')!) === moved;
    },
    sql: () => String(encode(sql, store.getQuery(), fields)),
  };
}
