/** @jsxImportSource solid-js */
import {
  CLASS,
  DEFAULT_LABELS,
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
} from '@trawlnet/core';
import { createContext, createEffect, createMemo, createSignal, For, Match, on, onCleanup, Show, Switch, useContext, type Component, type JSX } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import {
  makeContextValue,
  QueryContext,
  useDragHandle,
  useDropTarget,
  useGroup,
  useGroupDropZone,
  useNode,
  useQueryStore,
  useRule,
  useStore,
} from './primitives';

export { DEFAULT_LABELS };
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

interface OptionLike {
  readonly value: unknown;
  readonly label: string;
  readonly depth?: number;
  readonly disabled?: boolean;
}

const OptionList = (props: { options: readonly OptionLike[] }) => (
  <For each={props.options}>
    {(o) => (
      <option value={String(o.value)} disabled={o.disabled}>
        {'  '.repeat(o.depth ?? 0) + o.label}
      </option>
    )}
  </For>
);

/** A function call with each argument at its default literal. */
export const defaultCall = (fields: Fields, fn: string): FnCall => {
  const def = functionOf(fields, { fn, args: {} });
  return { fn, args: Object.fromEntries(Object.entries(def?.args ?? {}).map(([name, a]) => [name, { value: a.defaultValue ?? null }])) };
};

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
  const [query, setQuery] = createSignal(props.multiple ? formatList(props.value) : formatInput(props.value));
  const [found, setFound] = createSignal<readonly OptionLike[]>([]);
  const listId = `tn-async-${Math.random().toString(36).slice(2)}`;
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
          props.onChange(
            props.multiple
              ? parseList({ ...props.def!, options: found() as never }, raw)
              : (found().find((o) => String(o.value) === raw)?.value ?? (props.def?.allowCustom ? raw : null)),
          );
        }}
      />
      <datalist id={listId}>
        <For each={found()}>{(o) => <option value={String(o.value)}>{o.label}</option>}</For>
      </datalist>
    </>
  );
}

function Scalar(props: ValueEditorProps) {
  const parse = (raw: string) => parseInput(props.def, raw);
  return (
    <Switch
      fallback={
        <input
          class={CLASS.value}
          type="text"
          value={formatInput(props.value)}
          placeholder={props.def?.placeholder}
          disabled={props.disabled}
          aria-invalid={props.invalid || undefined}
          onInput={(e) => props.onChange(e.currentTarget.value)}
        />
      }
    >
      <Match when={props.editor.async}>
        <AsyncInput def={props.def} value={props.value} onChange={props.onChange} invalid={props.invalid} disabled={props.disabled} />
      </Match>
      <Match when={props.editor.type === 'boolean'}>
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
      </Match>
      <Match when={props.editor.type === 'select'}>
        <select class={CLASS.value} value={formatInput(props.value)} disabled={props.disabled} aria-invalid={props.invalid || undefined} onChange={(e) => props.onChange(parse(e.currentTarget.value))}>
          <option value="">{props.labels.empty}</option>
          <OptionList options={props.editor.options ?? []} />
        </select>
      </Match>
      <Match when={props.editor.type === 'number'}>
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
      </Match>
      <Match when={props.editor.type === 'slider'}>
        <span class="tn-slider">
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
      </Match>
      <Match when={props.editor.type === 'date' || props.editor.type === 'time'}>
        <DraftInput type={props.editor.type} value={props.value} parse={parse} format={formatInput} onChange={props.onChange} invalid={props.invalid} disabled={props.disabled} />
      </Match>
      <Match when={props.editor.type === 'datetime'}>
        <DraftInput type="datetime-local" value={props.value} parse={parse} format={(v) => formatInput(v).slice(0, 16)} onChange={props.onChange} invalid={props.invalid} disabled={props.disabled} />
      </Match>
      <Match when={props.editor.type === 'textarea'}>
        <textarea
          class={CLASS.value}
          rows={2}
          value={formatInput(props.value)}
          placeholder={props.def?.placeholder}
          disabled={props.disabled}
          aria-invalid={props.invalid || undefined}
          onInput={(e) => props.onChange(e.currentTarget.value)}
        />
      </Match>
    </Switch>
  );
}

export function DefaultValueEditor(props: ValueEditorProps) {
  const pair = () => (Array.isArray(props.value) ? props.value : [null, null]);
  return (
    <Switch fallback={<Scalar {...props} />}>
      <Match when={props.editor.arity === 'none'}>{null}</Match>
      <Match when={props.editor.arity === 'two'}>
        <span class="tn-value-pair">
          <Scalar {...props} value={pair()[0]} onChange={(v) => props.onChange([v, pair()[1]])} />
          <span>{props.labels.rangeSeparator}</span>
          <Scalar {...props} value={pair()[1]} onChange={(v) => props.onChange([pair()[0], v])} />
        </span>
      </Match>
      <Match when={props.editor.arity === 'many' && props.editor.async}>
        <AsyncInput def={props.def} value={props.value} onChange={props.onChange} invalid={props.invalid} disabled={props.disabled} multiple />
      </Match>
      <Match when={props.editor.arity === 'many' && props.editor.type === 'multiselect'}>
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
      </Match>
      <Match when={props.editor.arity === 'many'}>
        <DraftInput type="text" value={props.value} parse={(raw) => parseList(props.def, raw)} format={formatList} onChange={props.onChange} invalid={props.invalid} disabled={props.disabled} />
      </Match>
    </Switch>
  );
}

function Select(props: { class: string; value: string | undefined; options: readonly OptionLike[]; onChange: (v: string) => void; disabled?: boolean }) {
  return (
    <select class={props.class} value={props.value} disabled={props.disabled} onChange={(e) => props.onChange(e.currentTarget.value)}>
      <OptionList options={props.options} />
    </select>
  );
}

/** Field picker with struct fields grouped under their struct label. */
function FieldSelect(props: { value: string; options: readonly FieldOption[]; onChange: (v: string) => void; disabled?: boolean }) {
  const groups = createMemo(() => {
    const out = new Map<string | undefined, FieldOption[]>();
    for (const o of props.options) out.set(o.group, [...(out.get(o.group) ?? []), o]);
    return [...out];
  });
  const render = (o: FieldOption) => (
    <option value={o.value} title={o.description}>
      {o.label}
    </option>
  );
  return (
    <select class={CLASS.field} value={props.value} disabled={props.disabled} onChange={(e) => props.onChange(e.currentTarget.value)}>
      <For each={groups()}>
        {([group, opts]) => (
          <Show when={group !== undefined} fallback={<For each={opts}>{render}</For>}>
            <optgroup label={group}>
              <For each={opts}>{render}</For>
            </optgroup>
          </Show>
        )}
      </For>
    </select>
  );
}

/** Editor for a function call: pick the function, then each argument (literal, field, or nested call). */
export function FunctionEditor(props: { call: FnCall; fields: Fields; kind?: string; onChange: (c: FnCall) => void; disabled?: boolean; labels: Labels }): JSX.Element {
  const fns = createMemo(() => functionOptions(props.fields, props.kind));
  const args = createMemo(() => Object.entries(functionOf(props.fields, props.call)?.args ?? {}));
  return (
    <span class="tn-function">
      <Select class="tn-function-name" value={props.call.fn} options={fns()} disabled={props.disabled} onChange={(fn) => props.onChange(defaultCall(props.fields, fn))} />
      <Show when={args().length > 0}>
        <span class="tn-function-args">
          (
          <For each={args()}>
            {([name, argDef], i) => (
              <span class="tn-function-arg">
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
  return (
    <span class="tn-operand" title={props.label}>
      <Show when={refs().length > 0 || nested().length > 0}>
        <select
          class="tn-source"
          value={source()}
          disabled={props.disabled}
          onChange={(e) => {
            const v = e.currentTarget.value;
            props.onChange(v === 'field' ? { ref: refs()[0]!.value } : v === 'function' ? defaultCall(props.fields, nested()[0]!.value) : { value: props.def.defaultValue ?? null });
          }}
        >
          <option value="value">{props.label}</option>
          <Show when={refs().length > 0}>
            <option value="field">{props.label}: field</option>
          </Show>
          <Show when={nested().length > 0}>
            <option value="function">{props.label}: ƒ</option>
          </Show>
        </select>
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

export function DefaultRule(props: { id: NodeId }) {
  const store = useStore();
  const ui = useUI();
  // Node ids never change for a mounted component.
  const id = props.id;
  const r = useRule(id);
  const drag = useDragHandle(id);
  const drop = useDropTarget(id);
  const invalid = createMemo(() => r.issues().some((i) => i.severity === 'error'));
  const lhsFunctions = createMemo(() => (store.settings.allowFunctions !== false ? functionOptions(r.fields()) : []));
  const fieldIsFn = () => isFnCall(r.field());

  return (
    <div
      class={cx(
        CLASS.rule,
        invalid() && CLASS.invalid,
        r.locked() && CLASS.locked,
        drag.isDragging() && CLASS.dragging,
        drop.position() === 'before' && CLASS.dropBefore,
        drop.position() === 'after' && CLASS.dropAfter,
      )}
      title={invalid() ? r.issues().map((i) => i.message).join('\n') : undefined}
      {...drop.dropProps}
    >
      <span class={CLASS.handle} aria-label={ui.labels.drag} {...drag.handleProps}>
        ⠿
      </span>
      <Show when={lhsFunctions().length > 0}>
        <button
          type="button"
          class={cx(CLASS.action, 'tn-lhs-toggle')}
          disabled={!r.can().editField}
          title={fieldIsFn() ? 'Use a field' : 'Use a function'}
          aria-pressed={fieldIsFn()}
          onClick={() => r.setField(fieldIsFn() ? r.fieldOptions()[0]!.value : defaultCall(r.fields(), lhsFunctions()[0]!.value))}
        >
          ƒ
        </button>
      </Show>
      <Show when={fieldIsFn()} fallback={<FieldSelect value={r.field() as string} options={r.fieldOptions()} disabled={!r.can().editField} onChange={r.setField} />}>
        <FunctionEditor call={r.field() as FnCall} fields={r.fields()} onChange={r.setField} disabled={!r.can().editField} labels={ui.labels} />
      </Show>
      <Select class={CLASS.operator} value={r.operator()} options={r.operators()} disabled={!r.can().editOperator} onChange={r.setOperator} />
      <Show when={r.refOptions().length > 0 || r.functionOptions().length > 0}>
        <select
          class="tn-source"
          value={r.source()}
          disabled={!r.can().editValue}
          aria-label="Compare with"
          onChange={(e) => {
            const v = e.currentTarget.value;
            v === 'field' ? r.setRef(r.refOptions()[0]!.value) : v === 'function' ? r.setCall(defaultCall(r.fields(), r.functionOptions()[0]!.value)) : r.setRef(null);
          }}
        >
          <option value="value">{ui.labels.compareValue}</option>
          <Show when={r.refOptions().length > 0}>
            <option value="field">{ui.labels.compareField}</option>
          </Show>
          <Show when={r.functionOptions().length > 0}>
            <option value="function">{ui.labels.compareFunction}</option>
          </Show>
        </select>
      </Show>
      <Switch
        fallback={
          <Dynamic
            component={ui.components.ValueEditor}
            editor={r.editor()}
            def={r.def()}
            value={r.value()}
            onChange={r.setValue}
            invalid={invalid()}
            disabled={!r.can().editValue}
            labels={ui.labels}
          />
        }
      >
        <Match when={r.source() === 'field'}>
          <Select class={CLASS.value} value={r.ref()} options={r.refOptions()} disabled={!r.can().editValue} onChange={r.setRef} />
        </Match>
        <Match when={r.source() === 'function'}>
          <FunctionEditor call={r.call()!} fields={r.fields()} kind={r.def()?.kind} onChange={r.setCall} disabled={!r.can().editValue} labels={ui.labels} />
        </Match>
      </Switch>
      <Show when={ui.showLock}>
        <button
          type="button"
          class={CLASS.action}
          disabled={!r.can().lock}
          aria-pressed={!!r.rule().locked}
          title={r.rule().locked ? ui.labels.unlock : ui.labels.lock}
          onClick={() => r.setLocked(!r.rule().locked)}
        >
          {r.rule().locked ? '🔒' : '🔓'}
        </button>
      </Show>
      <button type="button" class={CLASS.action} title={ui.labels.clone} aria-label={ui.labels.clone} disabled={!r.can().clone} onClick={r.clone}>
        ⧉
      </button>
      <button type="button" class={CLASS.action} title={ui.labels.remove} aria-label={ui.labels.remove} disabled={!r.can().remove} onClick={r.remove}>
        ×
      </button>
    </div>
  );
}

function NodeView(props: { id: NodeId }) {
  const ui = useUI();
  const node = useNode(props.id);
  const kind = createMemo(() => node().kind);
  return (
    <Show when={kind() === 'group'} fallback={<Dynamic component={ui.components.Rule} id={props.id} />}>
      <Dynamic component={ui.components.Group} id={props.id} />
    </Show>
  );
}

const COUNT_OPS: Option[] = [
  { value: 'gte', label: 'at least' },
  { value: 'lte', label: 'at most' },
  { value: 'eq', label: 'exactly' },
  { value: 'gt', label: 'more than' },
  { value: 'lt', label: 'fewer than' },
];

/** "some / all / none / at least N of Orders where …" for array groups. */
function MatchEditor(props: { match: Quantifier; label: string; onChange: (m: Quantifier) => void; disabled?: boolean; labels: Labels }) {
  const counted = () => (typeof props.match === 'object' && props.match.count !== 'between' ? (props.match as { count: 'gte'; value: number }) : null);
  return (
    <span class="tn-match">
      <select
        class="tn-match-mode"
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
            <Select class="tn-match-op" value={m().count} options={COUNT_OPS} disabled={props.disabled} onChange={(count) => props.onChange({ count: count as 'gte', value: m().value })} />
            <input
              class="tn-match-count"
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
  const store = useStore();
  const ui = useUI();
  const id = props.id;
  const g = useGroup(id);
  const drag = useDragHandle(id);
  const drop = useDropTarget(id);
  const zone = useGroupDropZone(id);
  const isRoot = g.isRoot();
  const arrayLabel = createMemo(() => {
    const of = g.of();
    return of ? fieldLabel(of.field, (isRoot ? store.fields : store.fieldsFor(id))[of.field]) : '';
  });

  return (
    <div
      class={cx(
        CLASS.group,
        !!g.of() && CLASS.arrayGroup,
        g.locked() && CLASS.locked,
        drag.isDragging() && CLASS.dragging,
        drop.position() === 'before' && CLASS.dropBefore,
        drop.position() === 'after' && CLASS.dropAfter,
      )}
      {...(isRoot ? {} : drop.dropProps)}
    >
      <div class={CLASS.groupHeader}>
        <Show when={!isRoot}>
          <span class={CLASS.handle} aria-label={ui.labels.drag} {...drag.handleProps}>
            ⠿
          </span>
        </Show>
        <Show when={g.of()}>{(of) => <MatchEditor match={of().match} label={arrayLabel()} onChange={g.setMatch} disabled={!g.can().editGroup} labels={ui.labels} />}</Show>
        <Show when={ui.showNot}>
          <label class={CLASS.not}>
            <input type="checkbox" checked={g.not()} disabled={!g.can().editGroup} onChange={(e) => g.setNot(e.currentTarget.checked)} />
            {ui.labels.not}
          </label>
        </Show>
        <select class={CLASS.combinator} value={g.combinator()} disabled={!g.can().editGroup} onChange={(e) => g.setCombinator(e.currentTarget.value as 'and' | 'or')}>
          <option value="and">{ui.labels.and}</option>
          <option value="or">{ui.labels.or}</option>
        </select>
        <button type="button" class={CLASS.action} disabled={!g.can().addRule} onClick={() => g.addRule()}>
          {ui.labels.addRule}
        </button>
        <button type="button" class={CLASS.action} disabled={!g.can().addGroup} onClick={() => g.addGroup()}>
          {ui.labels.addGroup}
        </button>
        <Show when={g.arrayFields().length > 0}>
          <select
            class="tn-add-array"
            value=""
            disabled={!g.can().addGroup}
            onChange={(e) => {
              const el = e.currentTarget;
              if (el.value) g.addArrayGroup(el.value);
              el.value = '';
            }}
          >
            <option value="">{ui.labels.addArrayGroup}</option>
            <For each={g.arrayFields()}>{(o) => <option value={o.value}>{o.label}</option>}</For>
          </select>
        </Show>
        <Show when={ui.showLock}>
          <button
            type="button"
            class={CLASS.action}
            disabled={!g.can().lock}
            aria-pressed={!!g.group().locked}
            title={g.group().locked ? ui.labels.unlock : ui.labels.lock}
            onClick={() => g.setLocked(!g.group().locked)}
          >
            {g.group().locked ? '🔒' : '🔓'}
          </button>
        </Show>
        <Show when={!isRoot}>
          <button type="button" class={CLASS.action} title={ui.labels.clone} aria-label={ui.labels.clone} disabled={!g.can().clone} onClick={g.clone}>
            ⧉
          </button>
          <button type="button" class={CLASS.action} title={ui.labels.remove} aria-label={ui.labels.remove} disabled={!g.can().remove} onClick={g.remove}>
            ×
          </button>
        </Show>
      </div>
      <div class={cx(CLASS.children, zone.isOver() && CLASS.dropInside)} {...zone.zoneProps}>
        <For each={g.children()}>{(c) => <NodeView id={c} />}</For>
      </div>
    </div>
  );
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
    if (!props.fields) throw new Error('trawlnet: <QueryBuilder> needs a `store` or `fields`');
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
  return (
    <QueryProvider store={store}>
      <UIContext.Provider value={ui}>
        <div class={props.class ? `${CLASS.root} ${props.class}` : CLASS.root}>
          <Dynamic component={ui.components.Group} id={rootId} />
        </div>
      </UIContext.Provider>
    </QueryProvider>
  );
}
