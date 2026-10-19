import '@syncfusion/ej2-material-theme/styles/query-builder/index.css';
import { QueryBuilder, type RuleModel } from '@syncfusion/ej2-querybuilder';
import { FIELDS, makeTree, isGroup, waitFor, type Adapter, type CGroup } from '../shared';
import { install } from '../runner';

const columns = FIELDS.map((f) => ({
  field: f.name,
  label: f.label,
  type: f.type === 'text' || f.type === 'select' ? 'string' : f.type,
  ...(f.type === 'select' && { values: f.options }),
}));

const toSf = (g: CGroup): RuleModel => ({
  condition: g.combinator,
  rules: g.rules.map((r) =>
    isGroup(r) ? toSf(r)
    : { field: r.field, label: FIELDS.find((f) => f.name === r.field)!.label, type: r.type === 'text' || r.type === 'select' ? 'string' : r.type, operator: 'equal', value: r.value as any },
  ),
});

let prepared: RuleModel;
let qb: QueryBuilder | null = null;

const adapter: Adapter = {
  name: 'Syncfusion QueryBuilder',
  prepare(n) {
    prepared = JSON.parse(JSON.stringify(toSf(makeTree(n))));
  },
  mount(el) {
    const host = document.createElement('div');
    el.appendChild(host);
    qb = new QueryBuilder({ columns: columns as any, rule: prepared, maxGroupCount: 1000 });
    qb.appendTo(host);
  },
  unmount() {
    qb?.destroy();
    qb = null;
  },
  ruleCount: (el) => el.querySelectorAll('.e-rule-container').length,
  textInputs: (el) =>
    Array.from(el.querySelectorAll<HTMLElement>('.e-rule-container')).flatMap((r) => {
      const input = r.querySelector<HTMLInputElement>('.e-rule-value input.e-textbox');
      return input && input.type === 'text' ? [input] : [];
    }),
  addRule: async (el) => {
    // Root group's "add" split-button opens a menu: Add Condition / Add Group.
    el.querySelector<HTMLButtonElement>('.e-query-builder > .e-group-container > .e-group-header .e-add-btn')!.click();
    const item = await waitFor(() => document.querySelector<HTMLElement>('.e-dropdown-popup.e-popup-open .e-addrule'));
    item.click();
  },
  sql: () => qb!.getSqlFromRules(qb!.getRules()),
  removeRule: (el, i) => rows(el)[i]!.querySelector<HTMLButtonElement>('.e-rule-delete')!.click(),
  async changeField(el, i, to) {
    await pickDropdown(rows(el)[i]!.querySelector('.e-rule-filter .e-ddl')!, to.label);
    const editor = to.type === 'number' ? '.e-rule-value input.e-numerictextbox' : '.e-rule-value input.e-textbox:not(.e-numerictextbox)';
    return () => rows(el)[i]!.querySelector<HTMLInputElement>('.e-rule-filter input.e-dropdownlist')!.value === to.label && !!rows(el)[i]!.querySelector(editor);
  },
  async changeOperator(el, i, negate) {
    const label = negate ? 'Not Equal' : 'Equal';
    await pickDropdown(rows(el)[i]!.querySelector('.e-rule-operator .e-ddl')!, label);
    return () => rows(el)[i]!.querySelector<HTMLInputElement>('.e-rule-operator input.e-dropdownlist')!.value === label;
  },
  notes: { reorder: 'Drag and drop is opt-in (allowDragAndDrop) and off by default; the suite uses default settings.' },
};

const rows = (el: HTMLElement) => el.querySelectorAll<HTMLElement>('.e-rule-container');

/** Open a Syncfusion DropDownList and click the item labelled `label`. */
async function pickDropdown(wrapper: HTMLElement, label: string) {
  wrapper.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  const item = await waitFor(() =>
    Array.from(document.querySelectorAll<HTMLElement>('.e-ddl.e-popup.e-popup-open li.e-list-item')).find((li) => li.textContent?.trim() === label),
  );
  item.click();
}

install(adapter);
