// Plain-DOM renderer over the same core: no framework. Each node subscribes to its own id and
// patches only its own elements, which is the shape a Vue/Svelte/Solid/Lit binding would take too.
import type { FieldDef } from '../shared';
import type { GroupNode, Id, QueryStore, RuleNode } from './core';

const OPS: Record<FieldDef['type'], string[]> = {
  text: ['=', '!=', 'contains', 'beginsWith', 'endsWith', 'null', 'notNull'],
  number: ['=', '!=', '<', '>', '<=', '>=', 'null', 'notNull'],
  select: ['=', '!=', 'null', 'notNull'],
  boolean: ['='],
};

function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Partial<HTMLElementTagNameMap[K]> = {}, ...kids: Node[]) {
  const el = Object.assign(document.createElement(tag), props);
  el.append(...kids);
  return el;
}
const options = (pairs: [string, string][]) => pairs.map(([value, text]) => h('option', { value, text }));

export function mountQueryBuilder(host: HTMLElement, store: QueryStore, fields: FieldDef[]) {
  const byName = new Map(fields.map((f) => [f.name, f]));
  const fieldOptions = fields.map((f) => [f.name, f.label] as [string, string]);
  const disposers = new Map<Id, () => void>();

  function dispose(id: Id) {
    disposers.get(id)?.();
    disposers.delete(id);
  }

  function renderRule(id: Id): HTMLElement {
    const row = h('div', { className: 'cqb-rule' });
    let fieldName = '';
    let valueEl: HTMLInputElement | HTMLSelectElement;
    const fieldSel = h('select', { onchange: () => store.updateRule(id, { field: fieldSel.value }) }, ...options(fieldOptions));
    const opSel = h('select', { onchange: () => store.updateRule(id, { operator: opSel.value }) });
    const remove = h('button', { textContent: '×', onclick: () => store.remove(id) });

    const sync = () => {
      const r = store.get<RuleNode>(id);
      const f = byName.get(r.field)!;
      if (r.field !== fieldName) {
        fieldName = r.field;
        fieldSel.value = r.field;
        opSel.replaceChildren(...options(OPS[f.type].map((o) => [o, o])));
        valueEl =
          f.type === 'select'
            ? h('select', { className: 'cqb-value', onchange: () => store.updateRule(id, { value: valueEl.value }) }, ...options(f.options!.map((o) => [o, o])))
            : f.type === 'boolean'
              ? h('input', { className: 'cqb-value', type: 'checkbox', onchange: () => store.updateRule(id, { value: (valueEl as HTMLInputElement).checked }) })
              : h('input', {
                  className: 'cqb-value',
                  type: f.type === 'number' ? 'number' : 'text',
                  oninput: () => store.updateRule(id, { value: f.type === 'number' ? (valueEl as HTMLInputElement).valueAsNumber : valueEl.value }),
                });
        row.replaceChildren(fieldSel, opSel, valueEl, remove);
      }
      opSel.value = r.operator;
      if (valueEl instanceof HTMLInputElement && valueEl.type === 'checkbox') valueEl.checked = !!r.value;
      else if (valueEl.value !== String(r.value ?? '')) valueEl.value = String(r.value ?? '');
    };
    sync();
    disposers.set(id, store.subscribe(id, sync));
    return row;
  }

  function renderGroup(id: Id): HTMLElement {
    const comb = h('select', { onchange: () => store.updateGroup(id, { combinator: comb.value as 'and' | 'or' }) }, ...options([['and', 'AND'], ['or', 'OR']]));
    const header = h(
      'div',
      { className: 'cqb-group-header' },
      comb,
      h('button', { className: 'cqb-add-rule', textContent: '+ Rule', onclick: () => store.add(id, { field: fields[0].name, operator: '=', value: '' }) }),
      h('button', { textContent: '+ Group', onclick: () => store.add(id, { combinator: 'and', rules: [] }) }),
    );
    if (id !== store.rootId) header.append(h('button', { textContent: '×', onclick: () => store.remove(id) }));
    const body = h('div', { className: 'cqb-children' });
    const rendered = new Map<Id, HTMLElement>();

    const sync = () => {
      const g = store.get<GroupNode>(id);
      comb.value = g.combinator;
      const next = new Set(g.children);
      for (const [cid, el] of rendered) if (!next.has(cid)) { el.remove(); rendered.delete(cid); dispose(cid); }
      // Keyed reconcile: reuse existing child elements, only create new ids.
      let prev: Element | null = null;
      for (const cid of g.children) {
        let el = rendered.get(cid);
        if (!el) {
          el = store.get(cid).kind === 'group' ? renderGroup(cid) : renderRule(cid);
          rendered.set(cid, el);
        }
        const want: Element | null = prev ? prev.nextElementSibling : body.firstElementChild;
        if (want !== el) body.insertBefore(el, want);
        prev = el;
      }
    };
    sync();
    disposers.set(id, store.subscribe(id, sync));
    return h('div', { className: 'cqb-group' }, header, body);
  }

  const root = h('div', { className: 'cqb' }, renderGroup(store.rootId));
  host.append(root);
  return () => {
    for (const d of disposers.values()) d();
    disposers.clear();
    root.remove();
  };
}
