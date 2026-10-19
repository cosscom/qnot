/** @jsxImportSource solid-js */
import {
  CLASS,
  countOptions,
  DEFAULT_LABELS,
  defaultCall,
  editorFor,
  fieldLabel,
  formatInput,
  formatList,
  functionOf,
  functionOptions,
  isFnCall,
  parseInput,
  parseList,
  refOptions,
  type AnyFieldDef,
  type EditorSpec,
  type FieldOption,
  type Fields,
  type FnCall,
  type Format,
  type NodeId,
  type Operand,
  type Option,
  type Quantifier,
  type QueryStore,
  type StoreSettings,
} from '@qnot/core';
import {
  createComponent,
  createContext,
  createEffect,
  createMemo,
  createRenderEffect,
  createRoot,
  createSignal,
  For,
  Match,
  on,
  onCleanup,
  Show,
  Switch,
  untrack,
  useContext,
  type Component,
  type JSX,
} from 'solid-js';
import { isServer } from 'solid-js/web';
import { cachedFunctionOptions, dndChannel, makeContextValue, nodeKind, QueryContext, shared, useCtx, useGroup, useQueryStore, useRule, useStore } from './primitives';

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

export interface Components {
  Group: Component<{ id: NodeId }>;
  Rule: Component<{ id: NodeId }>;
  ValueEditor: Component<ValueEditorProps>;
}

interface UI {
  labels: Labels;
  components: Components;
  showNot: boolean;
  showLock: boolean;
}

const UIContext = createContext<UI>();
const useUI = () => useContext(UIContext)!;

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');
const dropClass = (position: 'before' | 'after' | 'inside' | null) => (position === 'before' ? CLASS.dropBefore : position === 'after' && CLASS.dropAfter);

interface OptionLike {
  readonly value: unknown;
  readonly label: string;
  readonly depth?: number;
  readonly disabled?: boolean;
}

const NO_OPTIONS: readonly OptionLike[] = [];
const UNSET = {};

/**
 * A region that renders `render(key())` and re-renders only when the key changes: `<Show>` /
 * `<Switch>` / `<Dynamic>` in one computation (the insert effect that reads it). The rendered
 * subtree lives in its own root, disposed on swap and with the owner.
 */
function slot<K>(key: () => K, render: (k: K) => JSX.Element, empty: unknown = UNSET): () => JSX.Element {
  let current: unknown = UNSET;
  let view: JSX.Element;
  let dispose: (() => void) | undefined;
  onCleanup(() => dispose?.());
  return () => {
    const k = key();
    if (k !== current) {
      current = k;
      dispose?.();
      dispose = undefined;
      // An empty region needs no root.
      view =
        k === empty
          ? null
          : createRoot((d) => {
              dispose = d;
              return render(k);
            });
    }
    return view;
  };
}

/** `slot` for an optional region: nothing is created while `show()` is false. */
const when = (show: () => boolean, render: () => JSX.Element) => slot(show, render, false);

export function QueryProvider(props: { store: QueryStore<any, any>; children?: JSX.Element }) {
  // The store is fixed for the provider's lifetime.
  return <QueryContext.Provider value={makeContextValue(props.store)}>{props.children}</QueryContext.Provider>;
}

/** An input that keeps in-progress text ("1.", "3, ") while committing parsed values. */
function DraftInput(props: {
  type: string;
  value: unknown;
  parse: (raw: string) => unknown;
  format: (v: unknown) => string;
  onChange: (v: unknown) => void;
  invalid: boolean;
  disabled?: boolean;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}) {
  const [draft, setDraft] = createSignal(props.format(props.value));
  createEffect(
    on(
      () => props.value,
      (v) => {
        if (props.format(props.parse(draft())) !== props.format(v)) setDraft(props.format(v));
      },
      { defer: true },
    ),
  );
  return (
    <input
      class={CLASS.value}
      type={props.type}
      value={draft()}
      min={props.min}
      max={props.max}
      step={props.step}
      placeholder={props.placeholder}
      disabled={props.disabled}
      aria-invalid={props.invalid || undefined}
      onInput={(e) => {
        setDraft(e.currentTarget.value);
        props.onChange(props.parse(e.currentTarget.value));
      }}
    />
  );
}

/** Text input backed by the field's async `search`, suggesting options as the user types. */
function AsyncInput(props: { def: AnyFieldDef | undefined; value: unknown; onChange: (v: unknown) => void; invalid: boolean; disabled?: boolean; multiple?: boolean }) {
  const format = props.multiple ? formatList : formatInput;
  const [query, setQuery] = createSignal(format(props.value));
  const [found, setFound] = createSignal<readonly OptionLike[]>([]);
  // Follow external value changes (undo, controlled updates) without clobbering the text the user
  // is typing: only reset when the new value isn't what this input last emitted.
  let emitted: unknown = props.value;
  createEffect(
    on(
      () => props.value,
      (v) => {
        if (format(v) !== format(emitted)) {
          setQuery(format(v));
          emitted = v;
        }
      },
      { defer: true },
    ),
  );
  const listId = `qn-async-${Math.random().toString(36).slice(2)}`;
  createEffect(() => {
    const def = props.def;
    if (!def?.search) return;
    const ctrl = new AbortController();
    const term = props.multiple ? (query().split(',').pop() ?? '').trim() : query();
    const t = setTimeout(() => void def.search!(term, ctrl.signal).then(setFound, () => {}), 150);
    onCleanup(() => {
      clearTimeout(t);
      ctrl.abort();
    });
  });
  return (
    <>
      <input
        class={CLASS.value}
        list={listId}
        value={query()}
        disabled={props.disabled}
        aria-invalid={props.invalid || undefined}
        onInput={(e) => {
          const raw = e.currentTarget.value;
          setQuery(raw);
          emitted = props.multiple
            ? parseList({ ...props.def!, options: found() as never }, raw)
            : (found().find((o) => String(o.value) === raw)?.value ?? (props.def?.allowCustom ? raw : null));
          props.onChange(emitted);
        }}
      />
      <datalist id={listId}>
        <For each={found()}>{(o) => <option value={String(o.value)}>{o.label}</option>}</For>
      </datalist>
    </>
  );
}

// --- value editors -------------------------------------------------------------------------------

const SCALAR_TYPES = new Set(['boolean', 'select', 'number', 'slider', 'date', 'time', 'datetime', 'textarea']);
/** Which scalar widget an editor needs (the branch of the scalar editor to render). */
const scalarKind = (e: EditorSpec): string => (e.async ? 'async' : SCALAR_TYPES.has(e.type) ? e.type : 'text');
/** Which widget the default value editor renders: re-rendered only when this changes. */
function valueKind(e: EditorSpec): string {
  if (e.arity === 'none') return 'none';
  if (e.arity === 'two') return `two:${scalarKind(e)}`;
  if (e.arity === 'many') return e.async ? 'many:async' : e.type === 'multiselect' ? 'many:multiselect' : 'many:list';
  return scalarKind(e);
}

function renderScalar(kind: string, props: ValueEditorProps): JSX.Element {
  const parse = (raw: string) => parseInput(props.def, raw);
  switch (kind) {
    case 'async':
      return <AsyncInput def={props.def} value={props.value} onChange={props.onChange} invalid={props.invalid} disabled={props.disabled} />;
    case 'boolean':
      return (
        <select
          class={CLASS.value}
          value={formatInput(props.value)}
          disabled={props.disabled}
          aria-invalid={props.invalid || undefined}
          onChange={(e) => props.onChange(e.currentTarget.value === '' ? null : e.currentTarget.value === 'true')}
        >
          <option value="">{props.labels.empty}</option>
          <option value="true">{props.labels.yes}</option>
          <option value="false">{props.labels.no}</option>
        </select>
      );
    case 'select':
      return (
        <Select
          class={CLASS.value}
          value={formatInput(props.value)}
          options={props.editor.options ?? NO_OPTIONS}
          empty={props.labels.empty}
          disabled={props.disabled}
          invalid={props.invalid}
          onChange={(v) => props.onChange(parse(v))}
        />
      );
    case 'number':
      return (
        <DraftInput
          type="number"
          value={props.value}
          min={props.def?.min}
          max={props.def?.max}
          step={props.def?.step}
          placeholder={props.def?.placeholder}
          parse={parse}
          format={formatInput}
          onChange={props.onChange}
          invalid={props.invalid}
          disabled={props.disabled}
        />
      );
    case 'slider':
      return (
        <span class="qn-slider">
          <input
            class={CLASS.value}
            type="range"
            min={props.def?.min ?? 0}
            max={props.def?.max ?? 100}
            step={props.def?.step ?? 1}
            value={typeof props.value === 'number' ? props.value : (props.def?.min ?? 0)}
            disabled={props.disabled}
            aria-invalid={props.invalid || undefined}
            onInput={(e) => props.onChange(Number(e.currentTarget.value))}
          />
          <output>{formatInput(props.value)}</output>
        </span>
      );
    case 'date':
    case 'time':
      return <DraftInput type={kind} value={props.value} parse={parse} format={formatInput} onChange={props.onChange} invalid={props.invalid} disabled={props.disabled} />;
    case 'datetime':
      return (
        <DraftInput type="datetime-local" value={props.value} parse={parse} format={(v) => formatInput(v).slice(0, 16)} onChange={props.onChange} invalid={props.invalid} disabled={props.disabled} />
      );
    case 'textarea':
      return (
        <textarea
          class={CLASS.value}
          rows={2}
          value={formatInput(props.value)}
          placeholder={props.def?.placeholder}
          disabled={props.disabled}
          aria-invalid={props.invalid || undefined}
          onInput={(e) => props.onChange(e.currentTarget.value)}
        />
      );
    default:
      return (
        <input
          class={CLASS.value}
          type="text"
          value={formatInput(props.value)}
          placeholder={props.def?.placeholder}
          disabled={props.disabled}
          aria-invalid={props.invalid || undefined}
          onInput={(e) => props.onChange(e.currentTarget.value)}
        />
      );
  }
}

/** `props` with `value` / `onChange` narrowed to one side of a pair. */
function pairSide(props: ValueEditorProps, i: 0 | 1): ValueEditorProps {
  const pair = () => (Array.isArray(props.value) ? props.value : [null, null]);
  return {
    get editor() {
      return props.editor;
    },
    get def() {
      return props.def;
    },
    get value() {
      return pair()[i];
    },
    onChange: (v) => props.onChange(i === 0 ? [v, pair()[1]] : [pair()[0], v]),
    get invalid() {
      return props.invalid;
    },
    get disabled() {
      return props.disabled;
    },
    get labels() {
      return props.labels;
    },
  };
}

function renderValue(kind: string, props: ValueEditorProps): JSX.Element {
  if (kind === 'none') return null;
  if (kind.startsWith('two:')) {
    const scalar = kind.slice(4);
    return (
      <span class="qn-value-pair">
        {renderScalar(scalar, pairSide(props, 0))}
        <span>{props.labels.rangeSeparator}</span>
        {renderScalar(scalar, pairSide(props, 1))}
      </span>
    );
  }
  switch (kind) {
    case 'many:async':
      return <AsyncInput def={props.def} value={props.value} onChange={props.onChange} invalid={props.invalid} disabled={props.disabled} multiple />;
    case 'many:multiselect':
      return (
        <select
          class={CLASS.value}
          multiple
          disabled={props.disabled}
          aria-invalid={props.invalid || undefined}
          onChange={(e) => props.onChange([...e.currentTarget.selectedOptions].map((o) => parseInput(props.def, o.value)))}
        >
          <For each={props.editor.options ?? []}>
            {(o) => (
              <option value={String(o.value)} disabled={o.disabled} selected={Array.isArray(props.value) && props.value.map(String).includes(String(o.value))}>
                {'  '.repeat(o.depth) + o.label}
              </option>
            )}
          </For>
        </select>
      );
    case 'many:list':
      return <DraftInput type="text" value={props.value} parse={(raw) => parseList(props.def, raw)} format={formatList} onChange={props.onChange} invalid={props.invalid} disabled={props.disabled} />;
    default:
      return renderScalar(kind, props);
  }
}

function Scalar(props: ValueEditorProps): JSX.Element {
  return slot(
    () => scalarKind(props.editor),
    (k) => renderScalar(k, props),
  ) as unknown as JSX.Element;
}

export function DefaultValueEditor(props: ValueEditorProps): JSX.Element {
  return slot(
    () => valueKind(props.editor),
    (k) => renderValue(k, props),
  ) as unknown as JSX.Element;
}

// --- selects -------------------------------------------------------------------------------------

function option(value: string, label: string, disabled?: boolean, title?: string): HTMLOptionElement {
  const o = new Option(label, value);
  if (disabled) o.disabled = true;
  if (title) o.title = title;
  return o;
}

type Fill<O> = (el: HTMLSelectElement, options: readonly O[], empty: string | undefined, expanded: boolean) => void;

const fillOptions: Fill<OptionLike> = (el, options, empty) => {
  el.textContent = '';
  if (empty !== undefined) el.append(option('', empty));
  for (const o of options) el.append(option(String(o.value), '  '.repeat(o.depth ?? 0) + o.label, o.disabled));
};

/** Struct fields grouped under their struct label (only once expanded). */
const fillFields: Fill<FieldOption> = (el, options, _empty, expanded) => {
  el.textContent = '';
  const groups = new Map<string | undefined, FieldOption[]>();
  for (const o of options) {
    const key = expanded ? o.group : undefined;
    const list = groups.get(key);
    if (list) list.push(o);
    else groups.set(key, [o]);
  }
  for (const [group, list] of groups) {
    let parent: HTMLElement = el;
    if (group !== undefined) {
      parent = document.createElement('optgroup');
      (parent as HTMLOptGroupElement).label = group;
      el.append(parent);
    }
    for (const o of list) parent.append(option(o.value, o.label, false, o.description));
  }
};

interface SelectProps<O extends OptionLike = OptionLike> {
  class: string;
  value: string | undefined;
  options: readonly O[];
  onChange: (v: string) => void;
  disabled?: boolean;
  /** Placeholder option with value '' (always rendered). */
  empty?: string;
  invalid?: boolean;
  'aria-label'?: string;
}

/**
 * Selects render only their chosen option until the user reaches for them (hover, focus, press),
 * then the full list for good. Option elements are most of a rule's DOM, so large queries mount
 * with a fraction of the nodes. The list is built imperatively in one render effect per select
 * (no per-option computations); expansion happens synchronously inside the event, so the full list
 * is in the DOM before the browser opens the native list or handles arrow keys.
 */
function lazySelect<O extends OptionLike>(props: SelectProps<O>, fill: Fill<O>): JSX.Element {
  const cls = props.class;
  if (isServer) {
    return (
      <select class={cls} disabled={props.disabled} aria-label={props['aria-label']} aria-invalid={props.invalid || undefined}>
        {props.empty !== undefined && <option value="">{props.empty}</option>}
        {props.options
          .filter((o) => String(o.value) === props.value)
          .map((o) => (
            <option value={String(o.value)} selected>
              {o.label}
            </option>
          ))}
      </select>
    );
  }
  let expanded = false;
  let shown: readonly O[] | undefined;
  let shownEmpty: string | undefined;
  let shownValue: string | undefined;
  const sync = () => {
    const options = props.options;
    const value = props.value;
    const empty = props.empty;
    if (options !== shown || empty !== shownEmpty || (!expanded && value !== shownValue)) {
      shown = options;
      shownEmpty = empty;
      shownValue = value;
      fill(el, expanded ? options : options.filter((o) => String(o.value) === value), empty, expanded);
    }
    el.value = value ?? '';
  };
  const expand = () => {
    if (expanded) return;
    expanded = true;
    shown = undefined;
    untrack(sync);
  };
  const el = (<select class={cls} onFocus={expand} onPointerDown={expand} onMouseEnter={expand} onChange={(e) => props.onChange(e.currentTarget.value)} />) as HTMLSelectElement;
  let disabled = false;
  let invalid = false;
  let label: string | undefined;
  createRenderEffect(() => {
    sync();
    if (!!props.disabled !== disabled) el.disabled = disabled = !!props.disabled;
    if (!!props.invalid !== invalid) (invalid = !!props.invalid) ? el.setAttribute('aria-invalid', 'true') : el.removeAttribute('aria-invalid');
    if (props['aria-label'] !== label) (label = props['aria-label']) === undefined ? el.removeAttribute('aria-label') : el.setAttribute('aria-label', label);
  });
  return el;
}

const Select = (props: SelectProps) => lazySelect(props, fillOptions);

/** Field picker with struct fields grouped under their struct label (lazy like `Select`). */
const FieldSelect = (props: { value: string; options: readonly FieldOption[]; onChange: (v: string) => void; disabled?: boolean }) =>
  lazySelect<FieldOption>(
    {
      class: CLASS.field,
      get value() {
        return props.value;
      },
      get options() {
        return props.options;
      },
      get disabled() {
        return props.disabled;
      },
      onChange: (v) => props.onChange(v),
    },
    fillFields,
  );

/** "Compare with: value / field / function" options, shared per label set. */
const sourceLists = new WeakMap<Labels, Option[][]>();
function sourceOptions(labels: Labels, refs: boolean, fns: boolean): Option[] {
  let lists = sourceLists.get(labels);
  if (!lists) sourceLists.set(labels, (lists = []));
  return (lists[(refs ? 1 : 0) | (fns ? 2 : 0)] ??= [
    { value: 'value', label: labels.compareValue },
    ...(refs ? [{ value: 'field', label: labels.compareField }] : []),
    ...(fns ? [{ value: 'function', label: labels.compareFunction }] : []),
  ]);
}

/** Editor for a function call: pick the function, then each argument (literal, field, or nested call). */
export function FunctionEditor(props: { call: FnCall; fields: Fields; kind?: string; onChange: (c: FnCall) => void; disabled?: boolean; labels: Labels }): JSX.Element {
  const fns = createMemo(() => functionOptions(props.fields, props.kind));
  const args = createMemo(() => Object.entries(functionOf(props.fields, props.call)?.args ?? {}));
  return (
    <span class="qn-function">
      <Select class="qn-function-name" value={props.call.fn} options={fns()} disabled={props.disabled} onChange={(fn) => props.onChange(defaultCall(props.fields, fn))} />
      <Show when={args().length > 0}>
        <span class="qn-function-args">
          (
          <For each={args()}>
            {([name, argDef], i) => (
              <span class="qn-function-arg">
                {i() > 0 && ', '}
                <OperandEditor
                  operand={props.call.args[name] ?? { value: null }}
                  def={argDef}
                  fields={props.fields}
                  label={fieldLabel(name, argDef)}
                  disabled={props.disabled}
                  labels={props.labels}
                  onChange={(operand) => props.onChange({ ...props.call, args: { ...props.call.args, [name]: operand } })}
                />
              </span>
            )}
          </For>
          )
        </span>
      </Show>
    </span>
  );
}

function OperandEditor(props: { operand: Operand; def: AnyFieldDef; fields: Fields; label: string; onChange: (o: Operand) => void; disabled?: boolean; labels: Labels }): JSX.Element {
  const refs = createMemo(() => refOptions(props.fields, '', props.def.kind));
  const nested = createMemo(() => functionOptions(props.fields, props.def.kind));
  const source = () => (isFnCall(props.operand) ? 'function' : 'ref' in props.operand ? 'field' : 'value');
  const sources = createMemo(() => [
    { value: 'value', label: props.label },
    ...(refs().length ? [{ value: 'field', label: `${props.label}: field` }] : []),
    ...(nested().length ? [{ value: 'function', label: `${props.label}: ƒ` }] : []),
  ]);
  return (
    <span class="qn-operand" title={props.label}>
      <Show when={refs().length > 0 || nested().length > 0}>
        <Select
          class="qn-source"
          value={source()}
          options={sources()}
          disabled={props.disabled}
          onChange={(v) => props.onChange(v === 'field' ? { ref: refs()[0]!.value } : v === 'function' ? defaultCall(props.fields, nested()[0]!.value) : { value: props.def.defaultValue ?? null })}
        />
      </Show>
      <Switch
        fallback={
          <Scalar
            editor={editorFor(props.def, 'eq', props.fields)}
            def={props.def}
            value={(props.operand as { value: unknown }).value}
            invalid={false}
            disabled={props.disabled}
            labels={props.labels}
            onChange={(value) => props.onChange({ value })}
          />
        }
      >
        <Match when={source() === 'function'}>
          <FunctionEditor call={props.operand as FnCall} fields={props.fields} kind={props.def.kind} onChange={props.onChange} disabled={props.disabled} labels={props.labels} />
        </Match>
        <Match when={source() === 'field'}>
          <Select class={CLASS.value} value={(props.operand as { ref: string }).ref} options={refs()} disabled={props.disabled} onChange={(ref) => props.onChange({ ref })} />
        </Match>
      </Switch>
    </span>
  );
}

// --- rules and groups ----------------------------------------------------------------------------

const NO_FUNCTIONS: Option[] = [];
// Plain constants so the compiled row template treats them as static.
const ACTION = CLASS.action;
const HANDLE = CLASS.handle;

export function DefaultRule(props: { id: NodeId }) {
  const ui = useUI();
  const ctx = useCtx();
  // Node ids never change for a mounted component.
  const id = props.id;
  const r = useRule(id);
  const dnd = dndChannel(ctx);
  const settings = shared(ctx.store).settings;
  const { labels } = ui;
  const { drag, clone, remove } = labels;
  const invalid = () => r.issues().some((i) => i.severity === 'error');
  const lhsFunctions = () => (settings().allowFunctions !== false ? cachedFunctionOptions(r.fields()) : NO_FUNCTIONS);
  const fieldIsFn = () => isFnCall(r.field());
  const issueTitle = () => (invalid() ? r.issues().map((i) => i.message).join('\n') : undefined);

  const lhs = when(
    () => lhsFunctions().length > 0,
    () => (
      <button
        type="button"
        class="qn-action qn-lhs-toggle"
        disabled={!r.can().editField}
        title={fieldIsFn() ? labels.useField : labels.useFunction}
        aria-pressed={fieldIsFn()}
        onClick={() => r.setField(fieldIsFn() ? r.fieldOptions()[0]!.value : defaultCall(r.fields(), lhsFunctions()[0]!.value))}
      >
        ƒ
      </button>
    ),
  );
  const field = slot(fieldIsFn, (fn) =>
    fn ? (
      <FunctionEditor call={r.field() as FnCall} fields={r.fields()} onChange={r.setField} disabled={!r.can().editField} labels={labels} />
    ) : (
      <FieldSelect value={r.field() as string} options={r.fieldOptions()} disabled={!r.can().editField} onChange={r.setField} />
    ),
  );
  const source = when(
    () => r.refOptions().length > 0 || r.functionOptions().length > 0,
    () => (
      <Select
        class="qn-source"
        value={r.source()}
        options={sourceOptions(labels, r.refOptions().length > 0, r.functionOptions().length > 0)}
        disabled={!r.can().editValue}
        aria-label={labels.compareWith}
        onChange={(v) => (v === 'field' ? r.setRef(r.refOptions()[0]!.value) : v === 'function' ? r.setCall(defaultCall(r.fields(), r.functionOptions()[0]!.value)) : r.setRef(null))}
      />
    ),
  );
  // The right side: a field, a function, or the value editor. The default value editor is rendered
  // inline (keyed by the widget it needs) instead of through another component layer.
  const custom = ui.components.ValueEditor !== DefaultValueEditor;
  const valueProps: ValueEditorProps = {
    get editor() {
      return r.editor();
    },
    get def() {
      return r.def();
    },
    get value() {
      return r.value();
    },
    onChange: r.setValue,
    get invalid() {
      return invalid();
    },
    get disabled() {
      return !r.can().editValue;
    },
    labels,
  };
  const value = slot(
    () => {
      const s = r.source();
      return s !== 'value' ? s : custom ? 'custom' : valueKind(r.editor());
    },
    (k) =>
      k === 'field' ? (
        <Select class={CLASS.value} value={r.ref()} options={r.refOptions()} disabled={!r.can().editValue} onChange={r.setRef} />
      ) : k === 'function' ? (
        <FunctionEditor call={r.call()!} fields={r.fields()} kind={r.def()?.kind} onChange={r.setCall} disabled={!r.can().editValue} labels={labels} />
      ) : k === 'custom' ? (
        createComponent(ui.components.ValueEditor, valueProps)
      ) : (
        renderValue(k, valueProps)
      ),
  );
  const lock = ui.showLock && (
    <button
      type="button"
      class={CLASS.action}
      disabled={!r.can().lock}
      aria-pressed={!!r.rule().locked}
      title={r.rule().locked ? labels.unlock : labels.lock}
      onClick={() => r.setLocked(!r.rule().locked)}
    >
      {r.rule().locked ? '🔒' : '🔓'}
    </button>
  );

  return (
    <div
      class={cx(CLASS.rule, invalid() && CLASS.invalid, r.locked() && CLASS.locked, dnd.dragging(id) && CLASS.dragging, dropClass(dnd.position(id)))}
      title={issueTitle()}
      data-qn-id={id}
      onDragOver={dnd.rowDragOver}
      onDrop={dnd.drop}
    >
      <span class={HANDLE} aria-label={drag} draggable="true" onDragStart={dnd.handleDragStart} onDragEnd={dnd.handleDragEnd}>
        ⠿
      </span>
      {lhs()}
      {field()}
      <Select class={CLASS.operator} value={r.operator()} options={r.operators()} disabled={!r.can().editOperator} onChange={r.setOperator} />
      {source()}
      {value()}
      {lock}
      <button type="button" class={ACTION} title={clone} aria-label={clone} disabled={!r.can().clone} onClick={r.clone}>
        ⧉
      </button>
      <button type="button" class={ACTION} title={remove} aria-label={remove} disabled={!r.can().remove} onClick={r.remove}>
        ×
      </button>
    </div>
  );
}

/** A child of a group: its rule or group component, swapped if the node changes kind. */
function NodeView(props: { id: NodeId }): JSX.Element {
  const { components } = useUI();
  const id = props.id;
  return slot(nodeKind(useStore(), id), (kind) => createComponent(kind === 'group' ? components.Group : components.Rule, { id })) as unknown as JSX.Element;
}

/** "some / all / none / at least N of Orders where …" for array groups. */
function MatchEditor(props: { match: Quantifier; label: string; onChange: (m: Quantifier) => void; disabled?: boolean; labels: Labels }) {
  const counted = () => (typeof props.match === 'object' && props.match.count !== 'between' ? (props.match as { count: 'gte'; value: number }) : null);
  const counts = createMemo(() => countOptions(props.labels));
  return (
    <span class="qn-match">
      <select
        class="qn-match-mode"
        value={typeof props.match === 'string' ? props.match : 'count'}
        disabled={props.disabled}
        onChange={(e) => props.onChange(e.currentTarget.value === 'count' ? { count: 'gte', value: 1 } : (e.currentTarget.value as 'some' | 'all' | 'none'))}
      >
        <option value="some">{props.labels.some}</option>
        <option value="all">{props.labels.all}</option>
        <option value="none">{props.labels.none}</option>
        <option value="count">{props.labels.count}</option>
      </select>
      <Show when={counted()}>
        {(m) => (
          <>
            <Select class="qn-match-op" value={m().count} options={counts()} disabled={props.disabled} onChange={(count) => props.onChange({ count: count as 'gte', value: m().value })} />
            <input
              class="qn-match-count"
              type="number"
              min={0}
              value={m().value}
              disabled={props.disabled}
              onInput={(e) => props.onChange({ count: m().count, value: Number(e.currentTarget.value) })}
            />
          </>
        )}
      </Show>
      <span>
        {props.labels.matchOf} <strong>{props.label}</strong> {props.labels.matchWhere}
      </span>
    </span>
  );
}

export function DefaultGroup(props: { id: NodeId }) {
  const ctx = useCtx();
  const { store } = ctx;
  const ui = useUI();
  const { labels } = ui;
  const id = props.id;
  const g = useGroup(id);
  const dnd = dndChannel(ctx);
  const isRoot = g.isRoot();
  const arrayLabel = () => {
    const of = g.of();
    return of ? fieldLabel(of.field, (isRoot ? store.fields : store.fieldsFor(id))[of.field]) : '';
  };
  const match = when(
    () => !!g.of(),
    () => <MatchEditor match={g.of()?.match ?? 'some'} label={arrayLabel()} onChange={g.setMatch} disabled={!g.can().editGroup} labels={labels} />,
  );
  const arrayFields = when(
    () => g.arrayFields().length > 0,
    () => (
      <select
        class="qn-add-array"
        value=""
        disabled={!g.can().addGroup}
        onChange={(e) => {
          const el = e.currentTarget;
          if (el.value) g.addArrayGroup(el.value);
          el.value = '';
        }}
      >
        <option value="">{labels.addArrayGroup}</option>
        <For each={g.arrayFields()}>{(o) => <option value={o.value}>{o.label}</option>}</For>
      </select>
    ),
  );
  const handle = !isRoot && (
    <span class={HANDLE} aria-label={labels.drag} draggable="true" onDragStart={dnd.handleDragStart} onDragEnd={dnd.handleDragEnd}>
      ⠿
    </span>
  );
  const not = ui.showNot && (
    <label class={CLASS.not}>
      <input type="checkbox" checked={g.not()} disabled={!g.can().editGroup} onChange={(e) => g.setNot(e.currentTarget.checked)} />
      {labels.not}
    </label>
  );
  const lock = ui.showLock && (
    <button
      type="button"
      class={CLASS.action}
      disabled={!g.can().lock}
      aria-pressed={!!g.group().locked}
      title={g.group().locked ? labels.unlock : labels.lock}
      onClick={() => g.setLocked(!g.group().locked)}
    >
      {g.group().locked ? '🔒' : '🔓'}
    </button>
  );
  const actions = !isRoot && (
    <>
      <button type="button" class={CLASS.action} title={labels.clone} aria-label={labels.clone} disabled={!g.can().clone} onClick={g.clone}>
        ⧉
      </button>
      <button type="button" class={CLASS.action} title={labels.remove} aria-label={labels.remove} disabled={!g.can().remove} onClick={g.remove}>
        ×
      </button>
    </>
  );

  const el = (
    <div class={cx(CLASS.group, !!g.of() && CLASS.arrayGroup, g.locked() && CLASS.locked, dnd.dragging(id) && CLASS.dragging, dropClass(dnd.position(id)))}>
      <div class={CLASS.groupHeader}>
        {handle}
        {match()}
        {not}
        <select class={CLASS.combinator} value={g.combinator()} disabled={!g.can().editGroup} onChange={(e) => g.setCombinator(e.currentTarget.value as 'and' | 'or')}>
          <option value="and">{labels.and}</option>
          <option value="or">{labels.or}</option>
        </select>
        <button type="button" class={CLASS.action} disabled={!g.can().addRule} onClick={() => g.addRule()}>
          {labels.addRule}
        </button>
        <button type="button" class={CLASS.action} disabled={!g.can().addGroup} onClick={() => g.addGroup()}>
          {labels.addGroup}
        </button>
        {arrayFields()}
        {lock}
        {actions}
      </div>
      <div class={cx(CLASS.children, dnd.zone(id) && CLASS.dropInside)} onDragOver={(e) => dnd.zoneDragOver(e, id)} onDrop={dnd.drop}>
        <For each={g.children()}>{(c) => <NodeView id={c} />}</For>
      </div>
    </div>
  ) as HTMLDivElement;
  if (!isRoot && !isServer) {
    el.setAttribute('data-qn-id', id);
    el.addEventListener('dragover', dnd.rowDragOver);
    el.addEventListener('drop', dnd.drop);
  }
  return el;
}

export interface QueryBuilderProps<T> {
  store?: QueryStore<any, T>;
  fields?: Fields;
  initial?: T;
  format?: Format<T>;
  /** Store settings; changes are applied live. */
  settings?: StoreSettings;
  /** Controlled value in `format`'s shape. */
  value?: T;
  onChange?: (value: T) => void;
  /** Swap any built-in piece; unspecified ones keep their defaults. */
  components?: Partial<Components>;
  labels?: Partial<Labels>;
  class?: string;
  /** Show the NOT toggle on groups (default true). */
  showNot?: boolean;
  /** Show lock toggles on rules and groups (default false). */
  showLock?: boolean;
}

/**
 * Ready-made builder. Pass a `store`, or `fields` (+ `initial` or `value`/`onChange`, `format`,
 * `settings`) and it creates one. Store and options are read once; `value` and `settings` stay live.
 */
export function QueryBuilder<T = unknown>(props: QueryBuilderProps<T>): JSX.Element {
  // Store and options are read once, like the other bindings.
  let store = props.store;
  if (store) {
    const s = store;
    onCleanup(s.subscribe(() => props.onChange?.(s.getValue())));
    createEffect(
      on(
        () => props.value,
        (v) => {
          if (v !== undefined) s.setValue(v);
        },
      ),
    );
  } else {
    if (!props.fields) throw new Error('qnot: <QueryBuilder> needs a `store` or `fields`');
    store = useQueryStore<Fields, T>({
      fields: props.fields,
      initial: props.initial,
      format: props.format,
      value: () => props.value,
      onChange: (v: T) => props.onChange?.(v),
      ...(props.settings && { settings: props.settings }),
    } as never);
  }
  const s = store;
  createEffect(
    on(
      () => props.settings,
      (next) => {
        if (next) s.setSettings(next);
      },
      { defer: true },
    ),
  );
  const ui: UI = {
    labels: { ...DEFAULT_LABELS, ...props.labels },
    components: { Group: DefaultGroup, Rule: DefaultRule, ValueEditor: DefaultValueEditor, ...props.components },
    showNot: props.showNot ?? true,
    showLock: props.showLock ?? false,
  };
  const rootId = store.rootId;
  const Root = ui.components.Group;
  return (
    <QueryProvider store={store}>
      <UIContext.Provider value={ui}>
        <div class={props.class ? `${CLASS.root} ${props.class}` : CLASS.root}>
          <Root id={rootId} />
        </div>
      </UIContext.Provider>
    </QueryProvider>
  );
}
