import '@qnot/core/styles.css';
import { createQueryStore, defineFields, encode, f, type Fields, type Query, type QueryStore } from '@qnot/core';
import { sql } from '@qnot/core/formats/sql';
// By path rather than a bench dependency; esbuild resolves symlinks, so core stays one module.
import { mountQueryBuilder } from '../../../packages/dom/src/index';
import { FIELDS, makeTree, isGroup, type Adapter, type CGroup } from '../shared';
import { install } from '../runner';

const fields: Fields = defineFields(
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

let prepared: Query;
let store: QueryStore;
let dispose: (() => void) | null = null;

const adapter: Adapter = {
  name: '@qnot/dom',
  prepare(n) {
    prepared = JSON.parse(JSON.stringify(toNative(makeTree(n))));
  },
  mount(el) {
    store = createQueryStore({ fields, initial: prepared });
    dispose = mountQueryBuilder(el, store);
  },
  unmount() {
    dispose?.();
    dispose = null;
  },
  ruleCount: (el) => el.querySelectorAll('.qn-rule').length,
  textInputs: (el) => Array.from(el.querySelectorAll<HTMLInputElement>('.qn-rule input.qn-value[type="text"]')),
  addRule: (el) => {
    const header = el.querySelector('.qn > .qn-group > .qn-group-header')!;
    Array.from(header.querySelectorAll('button')).find((b) => b.textContent === '+ Rule')!.click();
  },
  sql: () => String(encode(sql, store.getQuery(), fields)),
};

install(adapter);
