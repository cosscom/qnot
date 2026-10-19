// Vanilla renderer: every rule/group view subscribes to its own node id and patches only its own
// elements, so a keystroke touches one row no matter how big the tree is. Permission-driven
// disabling listens on the store's permissions channel, which value edits never fire.
import {
  CLASS,
  countOptions,
  createDnd,
  DEFAULT_LABELS,
  defaultCall,
  editorFor,
  elementFields,
  fieldLabel,
  fieldOptions,
  formatInput,
  formatList,
  functionOf,
  functionOptions,
  isFnCall,
  leftDef,
  operatorOptions,
  parseInput,
  parseList,
  refOptions,
  type Action,
  type AnyFieldDef,
  type DndController,
  type EditorSpec,
  type FieldOption,
  type Fields,
  type FnCall,
  type GroupNode,
  type NodeId,
  type Operand,
  type Option,
  type Quantifier,
  type QueryStore,
  type RuleNode,
} from '@qnot/core';
import { bindDragHandle, bindDropTarget, bindGroupDropZone, type DropPosition } from './dnd';

export { DEFAULT_LABELS, defaultCall };
export type Labels = typeof DEFAULT_LABELS;

export interface ValueEditorProps {
  editor: EditorSpec;
  def: AnyFieldDef | undefined;
  value: unknown;
  onChange: (value: unknown) => void;
  invalid: boolean;
  disabled?: boolean;
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
  readonly showNot: boolean;
  readonly showLock: boolean;
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
  /** Show the NOT toggle on groups (default true). */
  showNot?: boolean;
  /** Show lock toggles on rules and groups (default false). */
  showLock?: boolean;
}

type Props<K extends keyof HTMLElementTagNameMap> = Partial<Omit<HTMLElementTagNameMap[K], 'style'>>;

function h<K extends keyof HTMLElementTagNameMap>(tag: K, props: Props<K> = {}, ...kids: (Node | string)[]): HTMLElementTagNameMap[K] {
  const el = Object.assign(document.createElement(tag), props);
  if (kids.length) el.append(...kids);
  return el;
}

const button = (label: string, onclick: () => void, title?: string, className: string = CLASS.action) => {
  const b = h('button', { type: 'button', className, textContent: label, onclick });
  if (title) {
    b.title = title;
    b.setAttribute('aria-label', title);
  }
  return b;
};

interface OptionLike {
  readonly value: unknown;
  readonly label: string;
  readonly depth?: number;
  readonly disabled?: boolean;
}

const optionEl = (o: OptionLike) => h('option', { value: String(o.value), textContent: '  '.repeat(o.depth ?? 0) + o.label, disabled: !!o.disabled });

const fillOptions = (sel: HTMLSelectElement, options: readonly OptionLike[], empty?: string) => {
  const els = options.map(optionEl);
  if (empty !== undefined) els.unshift(h('option', { value: '', textContent: empty }));
  sel.replaceChildren(...els);
};

/** Field picker options with struct fields grouped under `<optgroup>`s. */
const fillFieldOptions = (sel: HTMLSelectElement, options: readonly FieldOption[]) => {
  const groups = new Map<string | undefined, FieldOption[]>();
  for (const o of options) groups.set(o.group, [...(groups.get(o.group) ?? []), o]);
  const els: HTMLElement[] = [];
  for (const [group, opts] of groups) {
    const items = opts.map((o) => {
      const el = optionEl(o);
      if (o.description) el.title = o.description;
      return el;
    });
    els.push(...(group === undefined ? items : [h('optgroup', { label: group }, ...items)]));
  }
  sel.replaceChildren(...els);
};

/**
 * Selects render only their chosen option until the user reaches for them (hover, focus, press),
 * then the full list for good. Option elements are most of a rule's DOM, so large queries mount
 * with a fraction of the nodes. Expansion happens inside the event, before the browser opens the
 * native list or handles arrow keys.
 */
export interface LazySelect {
  /** Pass a stable `options` array; a new identity re-renders the (expanded) list. */
  update(options: readonly OptionLike[], value: string): void;
}

export function lazySelect(sel: HTMLSelectElement, opts: { empty?: string; grouped?: boolean } = {}): LazySelect {
  let options: readonly OptionLike[] = [];
  let value = '';
  let expanded = false;
  let shown: unknown = null;
  const renderAll = () => {
    if (opts.grouped) fillFieldOptions(sel, options as readonly FieldOption[]);
    else fillOptions(sel, options, opts.empty);
    shown = options;
  };
  const expand = () => {
    if (expanded) return;
    expanded = true;
    renderAll();
    sel.value = value;
  };
  sel.addEventListener('focus', expand);
  sel.addEventListener('pointerdown', expand);
  sel.addEventListener('mouseenter', expand);
  return {
    update(next, v) {
      const changed = next !== options;
      options = next;
      value = v;
      if (expanded) {
        if (changed) renderAll();
      } else if (changed || shown !== v) {
        const chosen = options.find((o) => String(o.value) === v);
        fillOptions(sel, chosen ? [chosen] : [], opts.empty);
        shown = v;
      }
      sel.value = v;
    },
  };
}

const setInvalid = (el: HTMLElement, invalid: boolean) => (invalid ? el.setAttribute('aria-invalid', 'true') : el.removeAttribute('aria-invalid'));

/** Bitmask of `store.can(action, id)` answers, cheap to compare between permission events. */
const permBits = (store: QueryStore<any, any>, id: NodeId, actions: readonly Action[]) => {
  let b = 0;
  if (store.get(id)) actions.forEach((a, i) => store.can(a, id) && (b |= 1 << i));
  return b;
};

const RULE_ACTIONS = ['editField', 'editOperator', 'editValue', 'remove', 'clone', 'lock'] as const;
const GROUP_ACTIONS = ['addRule', 'addGroup', 'editGroup', 'remove', 'clone', 'lock'] as const;
const has = <A extends Action>(actions: readonly A[], bits: number, a: A) => (bits & (1 << actions.indexOf(a))) !== 0;

// --- value editors -----------------------------------------------------------------------------

interface Control {
  el: HTMLElement;
  set(value: unknown, invalid: boolean, disabled: boolean): void;
  destroy?(): void;
}

/** Text input backed by the field's async `search`, suggesting options in a datalist. */
function asyncControl(def: AnyFieldDef | undefined, multiple: boolean, emit: (v: unknown) => void): Control {
  const listId = `qn-async-${Math.random().toString(36).slice(2)}`;
  const input = h('input', { className: CLASS.value });
  input.setAttribute('list', listId);
  const list = h('datalist', { id: listId });
  let options: readonly OptionLike[] = [];
  let ctrl: AbortController | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const search = () => {
    if (!def?.search) return;
    clearTimeout(timer);
    ctrl?.abort();
    const c = (ctrl = new AbortController());
    const term = multiple ? (input.value.split(',').pop() ?? '').trim() : input.value;
    timer = setTimeout(
      () =>
        void def.search!(term, c.signal).then(
          (o) => {
            options = o;
            list.replaceChildren(...o.map((x) => h('option', { value: String(x.value), textContent: x.label })));
          },
          () => {},
        ),
      150,
    );
  };
  const format = multiple ? formatList : formatInput;
  let emitted: unknown;
  let first = true;
  input.oninput = () => {
    emitted = multiple ? parseList({ ...def!, options: options as never }, input.value) : (options.find((o) => String(o.value) === input.value)?.value ?? (def?.allowCustom ? input.value : null));
    emit(emitted);
    search();
  };
  search();
  return {
    el: h('span', { className: 'qn-async' }, input, list),
    set(v, invalid, disabled) {
      // Follow external changes (undo, controlled updates), but keep text the user is typing when
      // the value is just what this input emitted.
      if (first || format(v) !== format(emitted)) {
        input.value = format(v);
        emitted = v;
      }
      first = false;
      setInvalid(input, invalid);
      input.disabled = disabled;
    },
    destroy() {
      clearTimeout(timer);
      ctrl?.abort();
    },
  };
}

function draftInput(type: string, parse: (raw: string) => unknown, format: (v: unknown) => string, emit: (v: unknown) => void, attrs: Props<'input'> = {}): Control {
  const input = h('input', { className: CLASS.value, type, ...attrs });
  input.oninput = () => emit(parse(input.value));
  return {
    el: input,
    set(v, invalid, disabled) {
      // Keep in-progress text ("1.") when it already parses to the stored value.
      if (format(parse(input.value)) !== format(v)) input.value = format(v);
      setInvalid(input, invalid);
      input.disabled = disabled;
    },
  };
}

function scalarControl(spec: EditorSpec, def: AnyFieldDef | undefined, labels: Labels, emit: (v: unknown) => void): Control {
  if (spec.async) return asyncControl(def, false, emit);
  const parse = (raw: string) => parseInput(def, raw);
  switch (spec.type) {
    case 'boolean':
    case 'select': {
      const sel = h('select', { className: CLASS.value });
      if (spec.type === 'boolean') {
        fillOptions(sel, [{ value: 'true', label: labels.yes }, { value: 'false', label: labels.no }], labels.empty);
        sel.onchange = () => emit(sel.value === '' ? null : sel.value === 'true');
      } else {
        const lazy = lazySelect(sel, { empty: labels.empty });
        const options = spec.options ?? [];
        sel.onchange = () => emit(parse(sel.value));
        return {
          el: sel,
          set(v, invalid, disabled) {
            lazy.update(options, formatInput(v));
            setInvalid(sel, invalid);
            sel.disabled = disabled;
          },
        };
      }
      return {
        el: sel,
        set(v, invalid, disabled) {
          sel.value = formatInput(v);
          setInvalid(sel, invalid);
          sel.disabled = disabled;
        },
      };
    }
    case 'number':
      return draftInput('number', parse, formatInput, emit, {
        ...(def?.min !== undefined && { min: String(def.min) }),
        ...(def?.max !== undefined && { max: String(def.max) }),
        ...(def?.step !== undefined && { step: String(def.step) }),
        ...(def?.placeholder && { placeholder: def.placeholder }),
      });
    case 'slider': {
      const range = h('input', { className: CLASS.value, type: 'range', min: String(def?.min ?? 0), max: String(def?.max ?? 100), step: String(def?.step ?? 1) });
      const out = h('output');
      range.oninput = () => emit(Number(range.value));
      return {
        el: h('span', { className: 'qn-slider' }, range, out),
        set(v, invalid, disabled) {
          range.value = String(typeof v === 'number' ? v : (def?.min ?? 0));
          out.textContent = formatInput(v);
          setInvalid(range, invalid);
          range.disabled = disabled;
        },
      };
    }
    case 'date':
    case 'time':
      return draftInput(spec.type, parse, formatInput, emit);
    case 'datetime':
      return draftInput('datetime-local', parse, (v) => formatInput(v).slice(0, 16), emit);
    case 'textarea': {
      const ta = h('textarea', { className: CLASS.value, rows: 2, ...(def?.placeholder && { placeholder: def.placeholder }) });
      ta.oninput = () => emit(ta.value);
      return {
        el: ta,
        set(v, invalid, disabled) {
          if (ta.value !== formatInput(v)) ta.value = formatInput(v);
          setInvalid(ta, invalid);
          ta.disabled = disabled;
        },
      };
    }
    default: {
      const input = h('input', { className: CLASS.value, type: 'text', ...(def?.placeholder && { placeholder: def.placeholder }) });
      input.oninput = () => emit(input.value);
      return {
        el: input,
        set(v, invalid, disabled) {
          if (input.value !== formatInput(v)) input.value = formatInput(v);
          setInvalid(input, invalid);
          input.disabled = disabled;
        },
      };
    }
  }
}

export const DefaultValueEditor: ValueEditorFactory = (initial) => {
  let props = initial;
  const { editor, def, labels } = initial;
  const emit = (v: unknown) => props.onChange(v);
  const wrap = (c: Control): ValueEditorInstance => {
    const update = (p: ValueEditorProps) => {
      props = p;
      c.set(p.value, p.invalid, !!p.disabled);
    };
    update(initial);
    return { el: c.el, update, ...(c.destroy && { destroy: c.destroy }) };
  };

  if (editor.arity === 'two') {
    const pair = () => (Array.isArray(props.value) ? props.value : [null, null]);
    const a = scalarControl(editor, def, labels, (v) => emit([v, pair()[1]]));
    const b = scalarControl(editor, def, labels, (v) => emit([pair()[0], v]));
    const el = h('span', { className: 'qn-value-pair' }, a.el, h('span', { textContent: labels.rangeSeparator }), b.el);
    const update = (p: ValueEditorProps) => {
      props = p;
      const [x, y] = pair();
      a.set(x, p.invalid, !!p.disabled);
      b.set(y, p.invalid, !!p.disabled);
    };
    update(initial);
    return { el, update };
  }

  if (editor.arity === 'many' && editor.async) return wrap(asyncControl(def, true, emit));

  if (editor.arity === 'many' && editor.type === 'multiselect') {
    const sel = h('select', { className: CLASS.value, multiple: true });
    fillOptions(sel, editor.options ?? []);
    sel.onchange = () => emit([...sel.selectedOptions].map((o) => parseInput(def, o.value)));
    return wrap({
      el: sel,
      set(v, invalid, disabled) {
        const chosen = new Set(Array.isArray(v) ? v.map(String) : []);
        for (const o of sel.options) o.selected = chosen.has(o.value);
        setInvalid(sel, invalid);
        sel.disabled = disabled;
      },
    });
  }

  if (editor.arity === 'many') return wrap(draftInput('text', (raw) => parseList(def, raw), formatList, emit));
  return wrap(scalarControl(editor, def, labels, emit));
};

// --- function and operand editors ----------------------------------------------------------------

interface CallEditor {
  el: HTMLElement;
  update(call: FnCall, disabled: boolean): void;
}

/** Function picker plus one operand editor per argument; patched in place while the function stays the same. */
export function functionEditor(fields: Fields, kind: string | undefined, initial: FnCall, onChange: (c: FnCall) => void, labels: Labels): CallEditor {
  let call = initial;
  const fns = functionOptions(fields, kind);
  const name = h('select', { className: 'qn-function-name', onchange: () => onChange(defaultCall(fields, name.value)) });
  const nameLazy = lazySelect(name);
  const argsEl = h('span', { className: 'qn-function-args' });
  const el = h('span', { className: 'qn-function' }, name, argsEl);
  let builtFor: string | null = null;
  let operands: { name: string; editor: OperandEditor }[] = [];

  const build = () => {
    const def = functionOf(fields, call);
    operands = [];
    const entries = Object.entries(def?.args ?? {});
    if (!entries.length) {
      argsEl.replaceChildren();
      argsEl.hidden = true;
      return;
    }
    argsEl.hidden = false;
    const kids: (Node | string)[] = ['('];
    entries.forEach(([argName, argDef], i) => {
      const editor = operandEditor(fields, argDef, fieldLabel(argName, argDef), call.args[argName] ?? { value: null }, (operand) => onChange({ ...call, args: { ...call.args, [argName]: operand } }), labels);
      operands.push({ name: argName, editor });
      kids.push(h('span', { className: 'qn-function-arg' }, ...(i > 0 ? [', '] : []), editor.el));
    });
    kids.push(')');
    argsEl.replaceChildren(...kids);
  };

  const update = (next: FnCall, disabled: boolean) => {
    call = next;
    nameLazy.update(fns, call.fn);
    name.disabled = disabled;
    if (builtFor !== call.fn) {
      builtFor = call.fn;
      build();
    }
    for (const o of operands) o.editor.update(call.args[o.name] ?? { value: null }, disabled);
  };
  update(initial, false);
  return { el, update };
}

interface OperandEditor {
  el: HTMLElement;
  update(operand: Operand, disabled: boolean): void;
}

function operandEditor(fields: Fields, def: AnyFieldDef, label: string, initial: Operand, onChange: (o: Operand) => void, labels: Labels): OperandEditor {
  const refs = refOptions(fields, '', def.kind);
  const nested = functionOptions(fields, def.kind);
  const el = h('span', { className: 'qn-operand', title: label });
  const host = h('span');
  host.style.display = 'contents';
  let source: string | null = null;
  let current = initial;
  const sourceSel = h('select', {
    className: 'qn-source',
    onchange: () =>
      onChange(sourceSel.value === 'field' ? { ref: refs[0]!.value } : sourceSel.value === 'function' ? defaultCall(fields, nested[0]!.value) : { value: def.defaultValue ?? null }),
  });
  const sources = [
    { value: 'value', label },
    ...(refs.length ? [{ value: 'field', label: `${label}: field` }] : []),
    ...(nested.length ? [{ value: 'function', label: `${label}: ƒ` }] : []),
  ];
  const sourceLazy = lazySelect(sourceSel);
  if (refs.length || nested.length) el.append(sourceSel);
  el.append(host);

  let inner: { update(o: Operand, disabled: boolean): void } | null = null;
  const update = (operand: Operand, disabled: boolean) => {
    current = operand;
    const next = isFnCall(operand) ? 'function' : 'ref' in operand ? 'field' : 'value';
    sourceLazy.update(sources, next);
    sourceSel.disabled = disabled;
    if (next !== source) {
      source = next;
      if (next === 'function') {
        const fe = functionEditor(fields, def.kind, operand as FnCall, onChange, labels);
        inner = { update: (o, d) => fe.update(o as FnCall, d) };
        host.replaceChildren(fe.el);
      } else if (next === 'field') {
        const sel = h('select', { className: CLASS.value, onchange: () => onChange({ ref: sel.value }) });
        const refLazy = lazySelect(sel);
        inner = {
          update(o, d) {
            refLazy.update(refs, (o as { ref: string }).ref);
            sel.disabled = d;
          },
        };
        host.replaceChildren(sel);
      } else {
        const c = scalarControl(editorFor(def, 'eq', fields), def, labels, (value) => onChange({ value }));
        inner = { update: (o, d) => c.set((o as { value: unknown }).value, false, d) };
        host.replaceChildren(c.el);
      }
    }
    inner!.update(current, disabled);
  };
  update(initial, false);
  return { el, update };
}

// --- rule --------------------------------------------------------------------------------------

export function DefaultRule(ctx: MountContext, id: NodeId): NodeView {
  const { store, dnd, labels } = ctx;
  const row = h('div', { className: CLASS.rule });
  const handle = h('span', { className: CLASS.handle, textContent: '⠿' });
  handle.setAttribute('aria-label', labels.drag);
  const lhsToggle = button('ƒ', () => {
    const r = store.getRule(id);
    store.setField(id, (isFnCall(r.field) ? fieldChoices[0]!.value : defaultCall(fields, lhsFunctions[0]!.value)) as never);
  }, undefined, `${CLASS.action} qn-lhs-toggle`);
  const lhsHost = h('span');
  lhsHost.style.display = 'contents';
  const fieldSel = h('select', { className: CLASS.field, onchange: () => store.setField(id, fieldSel.value as never) });
  const opSel = h('select', { className: CLASS.operator, onchange: () => store.setOperator(id, opSel.value) });
  const sourceSel = h('select', {
    className: 'qn-source',
    onchange: () =>
      sourceSel.value === 'field' ? store.setRef(id, refs[0]!.value) : sourceSel.value === 'function' ? store.setCall(id, defaultCall(fields, functions[0]!.value)) : store.setRef(id, null),
  });
  sourceSel.setAttribute('aria-label', labels.compareWith);
  const valueHost = h('span');
  valueHost.style.display = 'contents';
  const refSel = h('select', { className: CLASS.value, onchange: () => store.setRef(id, refSel.value) });
  const fieldLazy = lazySelect(fieldSel, { grouped: true });
  const opLazy = lazySelect(opSel);
  const sourceLazy = lazySelect(sourceSel);
  const refLazy = lazySelect(refSel);
  let ops: Option[] = [];
  let sources: Option[] = [];
  const lockBtn = button('🔓', () => store.setLocked(id, !store.getRule(id).locked));
  const cloneBtn = button('⧉', () => store.clone(id), labels.clone);
  const removeBtn = button('×', () => void store.requestRemove(id), labels.remove);
  row.append(handle, lhsHost, opSel, valueHost);
  if (ctx.showLock) row.append(lockBtn);
  row.append(cloneBtn, removeBtn);

  let fields: Fields = store.fieldsFor(id);
  let fieldsFor: NodeId | null | undefined;
  let fieldChoices: FieldOption[] = [];
  let lhsFunctions: Option[] = [];
  let refs: Option[] = [];
  let functions: Option[] = [];
  let opsKey: unknown = null;
  let sourceKey = '';
  let editor: ValueEditorInstance | null = null;
  let editorKey = '';
  let lhsFn: CallEditor | null = null;
  let rhsFn: CallEditor | null = null;
  let bits = permBits(store, id, RULE_ACTIONS);
  let locked = store.isLocked(id);
  let settings = store.settings;

  const dropEditor = () => {
    editor?.destroy?.();
    editor = null;
    editorKey = '';
  };
  const can = (a: (typeof RULE_ACTIONS)[number]) => has(RULE_ACTIONS, bits, a);

  const sync = () => {
    const r = store.get(id) as RuleNode | undefined;
    if (!r || r.kind !== 'rule') return;
    if (fieldsFor !== r.parent) {
      // The schema in scope: the array's element fields inside array groups.
      fieldsFor = r.parent;
      fields = store.fieldsFor(id);
      fieldChoices = fieldOptions(fields).filter((o) => !o.isArray);
      lhsFunctions = store.settings.allowFunctions !== false ? functionOptions(fields) : [];
      opsKey = null;
      lhsFn = null;
    }
    const def = leftDef(fields, r.field);
    const spec = editorFor(def, r.operator, fields);

    // Left side: a field or a function call.
    // Controls that don't apply are detached rather than hidden: fewer nodes in big queries.
    attach(lhsToggle, lhsFunctions.length > 0, lhsHost);
    lhsToggle.disabled = !can('editField');
    const fieldIsFn = isFnCall(r.field);
    lhsToggle.title = fieldIsFn ? labels.useField : labels.useFunction;
    lhsToggle.setAttribute('aria-pressed', String(fieldIsFn));
    if (fieldIsFn) {
      if (!lhsFn) {
        lhsFn = functionEditor(fields, undefined, r.field as FnCall, (c) => store.setField(id, c as never), labels);
        lhsHost.replaceChildren(lhsFn.el);
      }
      lhsFn.update(r.field as FnCall, !can('editField'));
    } else {
      lhsFn = null;
      if (lhsHost.firstChild !== fieldSel) lhsHost.replaceChildren(fieldSel);
      fieldLazy.update(fieldChoices, r.field as string);
      fieldSel.disabled = !can('editField');
    }

    if (opsKey !== def) {
      ops = operatorOptions(def, fields);
      opsKey = def;
    }
    opLazy.update(ops, r.operator);
    opSel.disabled = !can('editOperator');

    const issues = store.issues(id);
    const invalid = issues.some((i) => i.severity === 'error');
    row.classList.toggle(CLASS.invalid, invalid);
    row.classList.toggle(CLASS.locked, locked);
    if (invalid) row.title = issues.map((i) => i.message).join('\n');
    else row.removeAttribute('title');

    // Right side source: literal, another field, or a function.
    const key = `${typeof r.field === 'string' ? r.field : ''}|${def?.kind}|${spec.allowsRef}`;
    if (key !== sourceKey) {
      sourceKey = key;
      refs = spec.allowsRef && store.settings.allowRefs !== false && typeof r.field === 'string' ? refOptions(fields, r.field, def?.kind) : [];
      functions = spec.allowsRef && store.settings.allowFunctions !== false ? functionOptions(fields, def?.kind) : [];
      sources = [
        { value: 'value', label: labels.compareValue },
        ...(refs.length ? [{ value: 'field', label: labels.compareField }] : []),
        ...(functions.length ? [{ value: 'function', label: labels.compareFunction }] : []),
      ];
      rhsFn = null;
    }
    const source = r.ref !== undefined ? 'field' : r.call !== undefined ? 'function' : 'value';
    attach(sourceSel, refs.length > 0 || functions.length > 0, valueHost);
    sourceLazy.update(sources, source);
    sourceSel.disabled = !can('editValue');

    if (r.ref !== undefined) {
      dropEditor();
      rhsFn = null;
      refLazy.update(refs, r.ref);
      refSel.disabled = !can('editValue');
      if (valueHost.firstChild !== refSel) valueHost.replaceChildren(refSel);
    } else if (r.call !== undefined) {
      dropEditor();
      if (!rhsFn) {
        rhsFn = functionEditor(fields, def?.kind, r.call, (c) => store.setCall(id, c), labels);
        valueHost.replaceChildren(rhsFn.el);
      }
      rhsFn.update(r.call, !can('editValue'));
    } else if (spec.arity === 'none') {
      dropEditor();
      rhsFn = null;
      valueHost.replaceChildren();
    } else {
      rhsFn = null;
      const props: ValueEditorProps = { editor: spec, def, value: r.value, onChange: (v) => store.setRuleValue(id, v), invalid, disabled: !can('editValue'), labels };
      const k = `${spec.type}|${spec.arity}|${spec.async}|${typeof r.field === 'string' ? r.field : r.field.fn}`;
      if (k !== editorKey || !editor) {
        dropEditor();
        editor = ctx.components.ValueEditor(props);
        editorKey = k;
        valueHost.replaceChildren(editor.el);
      } else editor.update(props);
    }

    lockBtn.disabled = !can('lock');
    lockBtn.textContent = r.locked ? '🔒' : '🔓';
    lockBtn.title = r.locked ? labels.unlock : labels.lock;
    lockBtn.setAttribute('aria-pressed', String(!!r.locked));
    cloneBtn.disabled = !can('clone');
    removeBtn.disabled = !can('remove');
  };

  sync();
  const cleanups = [
    store.subscribe(id, sync),
    // Settings, locks and limits; value edits never fire this.
    store.subscribePermissions(() => {
      const next = permBits(store, id, RULE_ACTIONS);
      const nextLocked = store.isLocked(id);
      const settingsChanged = store.settings !== settings;
      if (next === bits && nextLocked === locked && !settingsChanged) return;
      bits = next;
      locked = nextLocked;
      if (settingsChanged) {
        // allowRefs / allowFunctions change which pickers exist.
        settings = store.settings;
        sourceKey = '';
        fieldsFor = undefined;
      }
      sync();
    }),
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

/** Insert `el` before `anchor` when `on`, otherwise take it out of the DOM. */
function attach(el: HTMLElement, on: boolean, anchor: Node) {
  if (on && !el.parentNode) anchor.parentNode!.insertBefore(el, anchor);
  else if (!on && el.parentNode) el.remove();
}

function toggleDrop(el: HTMLElement, p: DropPosition) {
  el.classList.toggle(CLASS.dropBefore, p === 'before');
  el.classList.toggle(CLASS.dropAfter, p === 'after');
}

// --- group -------------------------------------------------------------------------------------

/** "some / all / none / at least N of Orders where …" for array groups. */
function matchEditor(labels: Labels, onChange: (m: Quantifier) => void) {
  let match: Quantifier = 'some';
  const mode = h('select', {
    className: 'qn-match-mode',
    onchange: () => onChange(mode.value === 'count' ? { count: 'gte', value: 1 } : (mode.value as 'some' | 'all' | 'none')),
  });
  fillOptions(mode, [
    { value: 'some', label: labels.some },
    { value: 'all', label: labels.all },
    { value: 'none', label: labels.none },
    { value: 'count', label: labels.count },
  ]);
  const op = h('select', { className: 'qn-match-op', onchange: () => typeof match === 'object' && onChange({ count: op.value as 'gte', value: match.value as number }) });
  const opLazy = lazySelect(op);
  const counts = countOptions(labels);
  const count = h('input', { className: 'qn-match-count', type: 'number', min: '0', oninput: () => typeof match === 'object' && onChange({ count: match.count as 'gte', value: Number(count.value) }) });
  const strong = h('strong');
  const el = h('span', { className: 'qn-match' }, mode, op, count, h('span', {}, `${labels.matchOf} `, strong, ` ${labels.matchWhere}`));
  return {
    el,
    update(next: Quantifier, label: string, disabled: boolean) {
      match = next;
      mode.value = typeof next === 'string' ? next : 'count';
      const showCount = typeof next === 'object' && next.count !== 'between';
      op.hidden = count.hidden = !showCount;
      if (showCount) {
        opLazy.update(counts, next.count);
        if (Number(count.value) !== next.value || count.value === '') count.value = String(next.value);
      }
      strong.textContent = label;
      mode.disabled = op.disabled = count.disabled = disabled;
    },
  };
}

/** Fields visible to a group's children (element schema for array groups). */
function innerFields(store: QueryStore<any, any>, id: NodeId): Fields {
  const g = store.getGroup(id);
  const outer = g.parent === null ? store.fields : store.fieldsFor(id);
  return g.of && outer[g.of.field]?.of ? elementFields(outer, g.of.field) : outer;
}

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
  const match = matchEditor(labels, (m) => store.setMatch(id, m));
  const notBox = h('input', { type: 'checkbox', onchange: () => store.setNot(id, notBox.checked) });
  const comb = h('select', { className: CLASS.combinator, onchange: () => store.setCombinator(id, comb.value as 'and' | 'or') });
  fillOptions(comb, [{ value: 'and', label: labels.and }, { value: 'or', label: labels.or }]);
  const addRule = button(labels.addRule, () => store.addRule(id));
  const addGroup = button(labels.addGroup, () => store.addGroup(id));
  const addArray = h('select', { className: 'qn-add-array', onchange: () => addArray.value && store.addArrayGroup(id, addArray.value) });
  const lockBtn = button('🔓', () => store.setLocked(id, !store.getGroup(id).locked));
  const cloneBtn = button('⧉', () => store.clone(id), labels.clone);
  const removeBtn = button('×', () => void store.requestRemove(id), labels.remove);
  if (!isRoot) header.append(handle);
  header.append(match.el);
  if (ctx.showNot) header.append(h('label', { className: CLASS.not }, notBox, labels.not));
  header.append(comb, addRule, addGroup, addArray);
  if (ctx.showLock) header.append(lockBtn);
  if (!isRoot) header.append(cloneBtn, removeBtn);
  const body = h('div', { className: CLASS.children });
  el.append(header, body);

  const slots = new Map<NodeId, Slot>();
  let bits = permBits(store, id, GROUP_ACTIONS);
  let locked = store.isLocked(id);
  let scopeKey: unknown = undefined;
  const can = (a: (typeof GROUP_ACTIONS)[number]) => has(GROUP_ACTIONS, bits, a);

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
    const g = store.get(id) as GroupNode | undefined;
    if (!g || g.kind !== 'group') return;
    const scopeNow = `${g.parent}|${g.of?.field}`;
    if (scopeNow !== scopeKey) {
      scopeKey = scopeNow;
      fillOptions(addArray, fieldOptions(innerFields(store, id)).filter((o) => o.isArray), labels.addArrayGroup);
    }
    addArray.hidden = addArray.options.length <= 1;
    addArray.value = '';
    el.classList.toggle(CLASS.arrayGroup, !!g.of);
    el.classList.toggle(CLASS.locked, locked);
    match.el.hidden = !g.of;
    if (g.of) match.update(g.of.match, fieldLabel(g.of.field, (isRoot ? store.fields : store.fieldsFor(id))[g.of.field]), !can('editGroup'));
    notBox.checked = g.not;
    comb.value = g.combinator;
    notBox.disabled = comb.disabled = !can('editGroup');
    addRule.disabled = !can('addRule');
    addGroup.disabled = addArray.disabled = !can('addGroup');
    lockBtn.disabled = !can('lock');
    lockBtn.textContent = g.locked ? '🔒' : '🔓';
    lockBtn.title = g.locked ? labels.unlock : labels.lock;
    lockBtn.setAttribute('aria-pressed', String(!!g.locked));
    cloneBtn.disabled = !can('clone');
    removeBtn.disabled = !can('remove');

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
    store.subscribePermissions(() => {
      const next = permBits(store, id, GROUP_ACTIONS);
      const nextLocked = store.isLocked(id);
      if (next === bits && nextLocked === locked) return;
      bits = next;
      locked = nextLocked;
      sync();
    }),
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
    showNot: options.showNot ?? true,
    showLock: options.showLock ?? false,
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
