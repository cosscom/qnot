import 'react-querybuilder/dist/query-builder.css';
import { useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { QueryBuilder, formatQuery, type Field, type RuleGroupType, type RuleType } from 'react-querybuilder';
import { FIELDS, makeTree, isGroup, pickNative, type Adapter, type CGroup } from '../shared';
import { install } from '../runner';

const fields: Field[] = FIELDS.map((f) => ({
  name: f.name,
  label: f.label,
  ...(f.type === 'number' && { inputType: 'number' }),
  ...(f.type === 'select' && { valueEditorType: 'select', values: f.options!.map((o) => ({ name: o, label: o })) }),
  ...(f.type === 'boolean' && { valueEditorType: 'checkbox', defaultValue: false }),
}));

const toRqb = (g: CGroup): RuleGroupType => ({
  combinator: g.combinator,
  rules: g.rules.map((r) => (isGroup(r) ? toRqb(r) : ({ field: r.field, operator: '=', value: r.value } as RuleType))),
});

let root: Root | null = null;
let prepared: RuleGroupType;
let current: RuleGroupType;

function App({ initial }: { initial: RuleGroupType }) {
  const [query, setQuery] = useState(initial);
  current = query;
  return <QueryBuilder fields={fields} query={query} onQueryChange={(q) => { current = q; setQuery(q); }} />;
}

const adapter: Adapter = {
  name: 'react-querybuilder',
  prepare(n) {
    prepared = JSON.parse(JSON.stringify(toRqb(makeTree(n))));
  },
  mount(el) {
    current = prepared;
    root = createRoot(el);
    flushSync(() => root!.render(<App initial={current} />));
  },
  unmount() {
    root?.unmount();
    root = null;
  },
  ruleCount: (el) => el.querySelectorAll('.rule').length,
  textInputs: (el) =>
    Array.from(el.querySelectorAll<HTMLInputElement>('.rule')).flatMap((r) => {
      const f = r.querySelector<HTMLSelectElement>('.rule-fields')!.value;
      const input = r.querySelector<HTMLInputElement>('input.rule-value');
      return FIELDS.find((x) => x.name === f)?.type === 'text' && input ? [input] : [];
    }),
  addRule: (el) => el.querySelector<HTMLButtonElement>('.queryBuilder > .ruleGroup > .ruleGroup-header > .ruleGroup-addRule')!.click(),
  sql: () => formatQuery(current, 'sql'),
  removeRule: (el, i) => rows(el)[i]!.querySelector<HTMLButtonElement>('.rule-remove')!.click(),
  async changeField(el, i, to) {
    await pickNative(rows(el)[i]!.querySelector('.rule-fields')!, to.name);
    const type = to.type === 'number' ? 'number' : 'text';
    return () => rows(el)[i]!.querySelector<HTMLSelectElement>('.rule-fields')!.value === to.name && rows(el)[i]!.querySelector<HTMLInputElement>('input.rule-value')?.type === type;
  },
  async changeOperator(el, i, negate) {
    const op = negate ? '!=' : '=';
    await pickNative(rows(el)[i]!.querySelector('.rule-operators')!, op);
    return () => rows(el)[i]!.querySelector<HTMLSelectElement>('.rule-operators')!.value === op;
  },
  notes: { reorder: 'Drag and drop needs the separate @react-querybuilder/dnd and react-dnd packages; the default build has none.' },
};

const rows = (el: HTMLElement) => el.querySelectorAll<HTMLElement>('.rule');

install(adapter);
