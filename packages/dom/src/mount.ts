// Vanilla renderer: every rule/group view subscribes to its own node id and patches only its own
// elements, so a keystroke touches one row no matter how big the tree is.
import {
  CLASS,
  createDnd,
  editorFor,
  fieldOptions,
  formatInput,
  formatList,
  operatorOptions,
  parseInput,
  parseList,
  refOptions,
  type AnyFieldDef,
  type DndController,
  type EditorSpec,
  type EditorType,
  type NodeId,
  type Option,
  type QueryStore,
} from '@trawlnet/core';
import { bindDragHandle, bindDropTarget, bindGroupDropZone, type DropPosition } from './dnd';

export const DEFAULT_LABELS = {
  and: 'AND',
  or: 'OR',
  not: 'NOT',
  addRule: '+ Rule',
  addGroup: '+ Group',
  remove: 'Remove',
  clone: 'Duplicate',
  drag: 'Drag to move',
  compareField: 'Compare with another field',
  compareValue: 'Compare with a value',
  yes: 'Yes',
  no: 'No',
  empty: '—',
  rangeSeparator: 'and',
};
export type Labels = typeof DEFAULT_LABELS;

export interface ValueEditorProps {
  editor: EditorSpec;
  def: AnyFieldDef | undefined;
  value: unknown;
  onChange: (value: unknown) => void;
  invalid: boolean;
  labels: Labels;
}

/** A value editor owns its element and is patched in place with new props. */
export interface ValueEditorInstance {
  readonly el: HTMLElement;
  update(props: ValueEditorProps): void;
  destroy?(): void;
}
export type ValueEditorFactory = (props: ValueEditorProps) => ValueEditorInstance;

export interface NodeView {
  readonly el: HTMLElement;
  dispose(): void;
}

export interface MountContext {
  readonly store: QueryStore<any, any>;
  readonly dnd: DndController;
  readonly labels: Labels;
  readonly components: Components;
  readonly fieldOptions: readonly Option[];
  /** Render any node with the configured Rule/Group component. */
  renderNode(id: NodeId): NodeView;
}

export interface Components {
  Group: (ctx: MountContext, id: NodeId) => NodeView;
  Rule: (ctx: MountContext, id: NodeId) => NodeView;
  ValueEditor: ValueEditorFactory;
}

export interface MountOptions {
  /** Swap any built-in piece; unspecified ones keep their defaults. */
  components?: Partial<Components>;
  labels?: Partial<Labels>;
  className?: string;
}

type Props<K extends keyof HTMLElementTagNameMap> = Partial<Omit<HTMLElementTagNameMap[K], 'style'>>;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props<K> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const el = Object.assign(document.createElement(tag), props);
  if (kids.length) el.append(...kids);
  return el;
}

const button = (label: string, onclick: () => void, title?: string) => {
  const b = h('button', { type: 'button', className: CLASS.action, textContent: label, onclick });
  if (title) {
    b.title = title;
    b.setAttribute('aria-label', title);
  }
  return b;
};

const fillOptions = (sel: HTMLSelectElement, options: readonly { value: unknown; label: string }[], empty?: string) => {
  const els = options.map((o) => h('option', { value: String(o.value), textContent: o.label }));
  if (empty !== undefined) els.unshift(h('option', { value: '', textContent: empty }));
  sel.replaceChildren(...els);
};

const setInvalid = (el: HTMLElement, invalid: boolean) => (invalid ? el.setAttribute('aria-invalid', 'true') : el.removeAttribute('aria-invalid'));

// --- value editors -----------------------------------------------------------------------------

interface Control {
  el: HTMLInputElement | HTMLSelectElement;
  set(value: unknown, invalid: boolean): void;
}

function scalarControl(type: EditorType, def: AnyFieldDef | undefined, spec: EditorSpec, labels: Labels, emit: (v: unknown) => void): Control {
  if (type === 'boolean' || type === 'select') {
    const sel = h('select', { className: CLASS.value });
    if (type === 'boolean') {
      fillOptions(sel, [{ value: 'true', label: labels.yes }, { value: 'false', label: labels.no }], labels.empty);
      sel.onchange = () => emit(sel.value === '' ? null : sel.value === 'true');
    } else {
      fillOptions(sel, spec.options ?? [], labels.empty);
      sel.onchange = () => emit(parseInput(def, sel.value));
    }
    return {
      el: sel,
      set(v, invalid) {
        sel.value = formatInput(v);
        setInvalid(sel, invalid);
      },
    };
  }
  const draft = type === 'number' || type === 'date';
  const input = h('input', { className: CLASS.value, type: draft ? type : 'text' });
  input.oninput = () => emit(draft ? parseInput(def, input.value) : input.value);
  return {
    el: input,
    set(v, invalid) {
      // Keep in-progress text ("1.") when it already parses to the stored value.
      const current = draft ? formatInput(parseInput(def, input.value)) : input.value;
      if (current !== formatInput(v)) input.value = formatInput(v);
      setInvalid(input, invalid);
    },
  };
}

export const DefaultValueEditor: ValueEditorFactory = (initial) => {
  let props = initial;
  const { editor, def, labels } = initial;
  const emit = (v: unknown) => props.onChange(v);

  if (editor.arity === 'two') {
    const pair = () => (Array.isArray(props.value) ? props.value : [null, null]);
    const a = scalarControl(editor.type, def, editor, labels, (v) => emit([v, pair()[1]]));
    const b = scalarControl(editor.type, def, editor, labels, (v) => emit([pair()[0], v]));
    const el = h('span', { className: 'tn-value-pair' }, a.el, h('span', { textContent: labels.rangeSeparator }), b.el);
    const update = (p: ValueEditorProps) => {
      props = p;
      const [x, y] = pair();
      a.set(x, p.invalid);
      b.set(y, p.invalid);
    };
    update(initial);
    return { el, update };
  }

  if (editor.arity === 'many' && editor.type === 'multiselect') {
    const sel = h('select', { className: CLASS.value, multiple: true });
    fillOptions(sel, editor.options ?? []);
    sel.onchange = () => emit([...sel.selectedOptions].map((o) => parseInput(def, o.value)));
    const update = (p: ValueEditorProps) => {
      props = p;
      const chosen = new Set(Array.isArray(p.value) ? p.value.map(String) : []);
      for (const o of sel.options) o.selected = chosen.has(o.value);
      setInvalid(sel, p.invalid);
    };
    update(initial);
    return { el: sel, update };
  }

  if (editor.arity === 'many') {
    const input = h('input', { className: CLASS.value, type: 'text' });
    input.oninput = () => emit(parseList(def, input.value));
    const update = (p: ValueEditorProps) => {
      props = p;
      if (formatList(parseList(def, input.value)) !== formatList(p.value)) input.value = formatList(p.value);
      setInvalid(input, p.invalid);
    };
    update(initial);
    return { el: input, update };
  }

  const c = scalarControl(editor.type, def, editor, labels, emit);
  const update = (p: ValueEditorProps) => {
    props = p;
    c.set(p.value, p.invalid);
  };
  update(initial);
  return { el: c.el, update };
};

// --- rule --------------------------------------------------------------------------------------

export function DefaultRule(ctx: MountContext, id: NodeId): NodeView {
  const { store, dnd, labels } = ctx;
  const fields = store.fields;
  const row = h('div', { className: CLASS.rule });
  const handle = h('span', { className: CLASS.handle, textContent: '⠿' });
  handle.setAttribute('aria-label', labels.drag);
  const fieldSel = h('select', { className: CLASS.field, onchange: () => store.setField(id, fieldSel.value) });
  fillOptions(fieldSel, ctx.fieldOptions);
  const opSel = h('select', { className: CLASS.operator, onchange: () => store.setOperator(id, opSel.value as never) });
  const valueHost = h('span');
  valueHost.style.display = 'contents';
  const refSel = h('select', { className: CLASS.value, onchange: () => store.setRef(id, refSel.value) });
  let refs: Option[] = [];
  const refBtn = button('ƒ', () => {
    const r = store.getRule(id);
    store.setRef(id, r.ref === undefined ? (refs[0]?.value ?? null) : null);
  });
  row.append(handle, fieldSel, opSel, valueHost, refBtn, button('⧉', () => store.clone(id), labels.clone), button('×', () => store.remove(id), labels.remove));

  let opsFor: AnyFieldDef | undefined | null = null;
  let refsFor: string | null = null;
  let editor: ValueEditorInstance | null = null;
  let editorKey = '';

  const dropEditor = () => {
    editor?.destroy?.();
    editor = null;
    editorKey = '';
  };

  const sync = () => {
    const r = store.get(id);
    if (!r || r.kind !== 'rule') return;
    const def = fields[r.field];
    const spec = editorFor(def, r.operator);
    if (fieldSel.value !== r.field) fieldSel.value = r.field;
    if (opsFor !== def) {
      fillOptions(opSel, operatorOptions(def));
      opsFor = def;
    }
    opSel.value = r.operator;

    const issues = store.issues(id);
    const invalid = issues.some((i) => i.severity === 'error');
    row.classList.toggle(CLASS.invalid, invalid);
    if (invalid) row.title = issues.map((i) => i.message).join('\n');
    else row.removeAttribute('title');

    if (refsFor !== r.field) {
      refs = refOptions(fields, r.field);
      fillOptions(refSel, refs);
      refsFor = r.field;
    }
    const canRef = spec.allowsRef && refs.length > 0;
    refBtn.hidden = !canRef;
    refBtn.textContent = r.ref === undefined ? 'ƒ' : '✎';
    refBtn.title = r.ref === undefined ? labels.compareField : labels.compareValue;

    if (r.ref !== undefined) {
      dropEditor();
      refSel.value = r.ref;
      if (valueHost.firstChild !== refSel) valueHost.replaceChildren(refSel);
    } else if (spec.arity === 'none') {
      dropEditor();
      valueHost.replaceChildren();
    } else {
      const props: ValueEditorProps = { editor: spec, def, value: r.value, onChange: (v) => store.setRuleValue(id, v), invalid, labels };
      const key = `${spec.type}|${spec.arity}|${r.field}`;
      if (key !== editorKey || !editor) {
        dropEditor();
        editor = ctx.components.ValueEditor(props);
        editorKey = key;
        valueHost.replaceChildren(editor.el);
      } else editor.update(props);
    }
  };

  sync();
  const cleanups = [
    store.subscribe(id, sync),
    bindDragHandle(handle, dnd, id),
    bindDropTarget(row, store, dnd, id, (p) => toggleDrop(row, p)),
    dnd.subscribe(() => row.classList.toggle(CLASS.dragging, dnd.getState().dragging === id)),
  ];
  return {
    el: row,
    dispose() {
      cleanups.forEach((c) => c());
      dropEditor();
    },
  };
}

function toggleDrop(el: HTMLElement, p: DropPosition) {
  el.classList.toggle(CLASS.dropBefore, p === 'before');
  el.classList.toggle(CLASS.dropAfter, p === 'after');
}

// --- group -------------------------------------------------------------------------------------

interface Slot {
  view: NodeView;
  kind: 'rule' | 'group';
  unsub: () => void;
}

export function DefaultGroup(ctx: MountContext, id: NodeId): NodeView {
  const { store, dnd, labels } = ctx;
  const isRoot = store.getGroup(id).parent === null;
  const el = h('div', { className: CLASS.group });
  const header = h('div', { className: CLASS.groupHeader });
  const handle = h('span', { className: CLASS.handle, textContent: '⠿' });
  handle.setAttribute('aria-label', labels.drag);
  const notBox = h('input', { type: 'checkbox', onchange: () => store.setNot(id, notBox.checked) });
  const comb = h('select', { className: CLASS.combinator, onchange: () => store.setCombinator(id, comb.value as 'and' | 'or') });
  fillOptions(comb, [{ value: 'and', label: labels.and }, { value: 'or', label: labels.or }]);
  if (!isRoot) header.append(handle);
  header.append(
    h('label', { className: CLASS.not }, notBox, labels.not),
    comb,
    button(labels.addRule, () => store.addRule(id)),
    button(labels.addGroup, () => store.addGroup(id)),
  );
  if (!isRoot) header.append(button('⧉', () => store.clone(id), labels.clone), button('×', () => store.remove(id), labels.remove));
  const body = h('div', { className: CLASS.children });
  el.append(header, body);

  const slots = new Map<NodeId, Slot>();

  const makeSlot = (cid: NodeId): Slot => {
    const kind = store.get(cid)!.kind;
    const slot: Slot = { view: ctx.renderNode(cid), kind, unsub: () => {} };
    // A reconcile can turn a rule into a group under the same id; the parent isn't told, so
    // each slot watches its own node's kind.
    slot.unsub = store.subscribe(cid, () => {
      const k = store.get(cid)?.kind;
      if (!k || k === slot.kind) return;
      const old = slot.view;
      slot.view = ctx.renderNode(cid);
      slot.kind = k;
      old.el.replaceWith(slot.view.el);
      old.dispose();
    });
    return slot;
  };
  const dropSlot = (s: Slot) => {
    s.unsub();
    s.view.dispose();
    s.view.el.remove();
  };

  const sync = () => {
    const g = store.get(id);
    if (!g || g.kind !== 'group') return;
    notBox.checked = g.not;
    comb.value = g.combinator;
    const next = new Set(g.children);
    for (const [cid, s] of slots) {
      if (!next.has(cid)) {
        dropSlot(s);
        slots.delete(cid);
      }
    }
    // Keyed reconcile: reuse existing child views, create only new ids, move only what moved.
    let prev: Element | null = null;
    for (const cid of g.children) {
      let s = slots.get(cid);
      if (!s) slots.set(cid, (s = makeSlot(cid)));
      const want: Element | null = prev ? prev.nextElementSibling : body.firstElementChild;
      if (want !== s.view.el) body.insertBefore(s.view.el, want);
      prev = s.view.el;
    }
  };

  sync();
  const cleanups = [
    store.subscribe(id, sync),
    bindGroupDropZone(body, store, dnd, id, (over) => body.classList.toggle(CLASS.dropInside, over)),
  ];
  if (!isRoot) {
    cleanups.push(
      bindDragHandle(handle, dnd, id),
      bindDropTarget(el, store, dnd, id, (p) => toggleDrop(el, p)),
      dnd.subscribe(() => el.classList.toggle(CLASS.dragging, dnd.getState().dragging === id)),
    );
  }
  return {
    el,
    dispose() {
      cleanups.forEach((c) => c());
      slots.forEach(dropSlot);
      slots.clear();
    },
  };
}

// --- mount -------------------------------------------------------------------------------------

/** Render the default builder into `host`. Returns a function that unmounts it. */
export function mountQueryBuilder(host: HTMLElement, store: QueryStore<any, any>, options: MountOptions = {}): () => void {
  const components: Components = { Group: DefaultGroup, Rule: DefaultRule, ValueEditor: DefaultValueEditor, ...options.components };
  const ctx: MountContext = {
    store,
    dnd: createDnd(store),
    labels: { ...DEFAULT_LABELS, ...options.labels },
    components,
    fieldOptions: fieldOptions(store.fields),
    renderNode: (id) => (store.get(id)?.kind === 'group' ? components.Group(ctx, id) : components.Rule(ctx, id)),
  };
  const root = h('div', { className: options.className ? `${CLASS.root} ${options.className}` : CLASS.root });
  const view = components.Group(ctx, store.rootId);
  root.append(view.el);
  host.append(root);
  return () => {
    view.dispose();
    root.remove();
  };
}
