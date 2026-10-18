import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';
import 'jQuery-QueryBuilder/dist/css/query-builder.default.css';
import $ from 'jquery';
(window as any).jQuery = (window as any).$ = $;
import { FIELDS, makeTree, isGroup, type Adapter, type CGroup } from '../shared';
import { install } from '../runner';
// @ts-ignore
import qbSource from 'jQuery-QueryBuilder/dist/js/query-builder.standalone.js' with { type: 'text' };

const filters = FIELDS.map((f) =>
  f.type === 'text' ? { id: f.name, label: f.label, type: 'string' }
  : f.type === 'number' ? { id: f.name, label: f.label, type: 'integer' }
  : f.type === 'select' ? { id: f.name, label: f.label, type: 'string', input: 'select', values: f.options, operators: ['equal', 'not_equal'] }
  : { id: f.name, label: f.label, type: 'boolean', input: 'radio', values: { true: 'Yes', false: 'No' }, operators: ['equal'] },
);

const toJq = (g: CGroup): object => ({
  condition: g.combinator.toUpperCase(),
  rules: g.rules.map((r) => (isGroup(r) ? toJq(r) : { id: r.field, operator: 'equal', value: r.value })),
});

let prepared: object;
let $qb: any;

const adapter: Adapter = {
  name: 'jQuery QueryBuilder',
  prepare(n) {
    prepared = JSON.parse(JSON.stringify(toJq(makeTree(n))));
  },
  mount(el) {
    $qb = ($(el) as any).queryBuilder({ filters, rules: prepared, allow_empty: true });
  },
  unmount() {
    $qb?.queryBuilder('destroy');
    $qb = null;
  },
  ruleCount: (el) => el.querySelectorAll('.rule-container').length,
  textInputs: (el) =>
    Array.from(el.querySelectorAll<HTMLElement>('.rule-container')).flatMap((r) => {
      const f = r.querySelector<HTMLSelectElement>('.rule-filter-container select')!.value;
      const input = r.querySelector<HTMLInputElement>('.rule-value-container input[type="text"]');
      return FIELDS.find((x) => x.name === f)?.type === 'text' && input ? [input] : [];
    }),
  addRule: (el) => el.querySelector<HTMLButtonElement>('.query-builder > .rules-group-container > .rules-group-header [data-add="rule"]')!.click(),
  sql: () => $qb.queryBuilder('getSQL', false).sql,
};

// Bundled as text and evaluated with this === window, like a classic <script>: its UMD wrapper
// otherwise takes the global branch with this === exports and never finds jQuery.
new Function(qbSource).call(window);
install(adapter);
