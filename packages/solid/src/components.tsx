/** @jsxImportSource solid-js */
import {
  CLASS,
  fieldOptions,
  formatInput,
  formatList,
  parseInput,
  parseList,
  refOptions,
  type AnyFieldDef,
  type EditorSpec,
  type Fields,
  type Format,
  type NodeId,
  type Option,
  type QueryStore,
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

export interface Components {
  Group: Component<{ id: NodeId }>;
  Rule: Component<{ id: NodeId }>;
  ValueEditor: Component<ValueEditorProps>;
}

interface UI {
  labels: Labels;
  components: Components;
  fieldOptions: Option[];
}

const UIContext = createContext<UI>();
const useUI = () => useContext(UIContext)!;

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

export function QueryProvider(props: { store: QueryStore<any, any>; children?: JSX.Element }) {
  // The store is fixed for the provider's lifetime.
  return <QueryContext.Provider value={makeContextValue(props.store)}>{props.children}</QueryContext.Provider>;
}

/** An input that keeps in-progress text ("1.", "3, ") while committing parsed values. */
function DraftInput(props: { type: string; value: unknown; parse: (raw: string) => unknown; format: (v: unknown) => string; onChange: (v: unknown) => void; invalid: boolean }) {
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
      aria-invalid={props.invalid || undefined}
      onInput={(e) => {
        setDraft(e.currentTarget.value);
        props.onChange(props.parse(e.currentTarget.value));
      }}
    />
  );
}

function Scalar(props: ValueEditorProps) {
  return (
    <Switch fallback={<input class={CLASS.value} type="text" value={formatInput(props.value)} aria-invalid={props.invalid || undefined} onInput={(e) => props.onChange(e.currentTarget.value)} />}>
      <Match when={props.editor.type === 'boolean'}>
        <select
          class={CLASS.value}
          value={formatInput(props.value)}
          aria-invalid={props.invalid || undefined}
          onChange={(e) => props.onChange(e.currentTarget.value === '' ? null : e.currentTarget.value === 'true')}
        >
          <option value="">{props.labels.empty}</option>
          <option value="true">{props.labels.yes}</option>
          <option value="false">{props.labels.no}</option>
        </select>
      </Match>
      <Match when={props.editor.type === 'select'}>
        <select class={CLASS.value} value={formatInput(props.value)} aria-invalid={props.invalid || undefined} onChange={(e) => props.onChange(parseInput(props.def, e.currentTarget.value))}>
          <option value="">{props.labels.empty}</option>
          <For each={props.editor.options ?? []}>{(o) => <option value={String(o.value)}>{o.label}</option>}</For>
        </select>
      </Match>
      <Match when={props.editor.type === 'number' || props.editor.type === 'date'}>
        <DraftInput type={props.editor.type} value={props.value} parse={(raw) => parseInput(props.def, raw)} format={formatInput} onChange={props.onChange} invalid={props.invalid} />
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
      <Match when={props.editor.arity === 'many' && props.editor.type === 'multiselect'}>
        <select
          class={CLASS.value}
          multiple
          aria-invalid={props.invalid || undefined}
          onChange={(e) => props.onChange([...e.currentTarget.selectedOptions].map((o) => parseInput(props.def, o.value)))}
        >
          <For each={props.editor.options ?? []}>
            {(o) => (
              <option value={String(o.value)} selected={Array.isArray(props.value) && props.value.map(String).includes(String(o.value))}>
                {o.label}
              </option>
            )}
          </For>
        </select>
      </Match>
      <Match when={props.editor.arity === 'many'}>
        <DraftInput type="text" value={props.value} parse={(raw) => parseList(props.def, raw)} format={formatList} onChange={props.onChange} invalid={props.invalid} />
      </Match>
    </Switch>
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
  const refs = createMemo(() => (r.editor().allowsRef ? refOptions(store.fields, r.field()) : []));

  return (
    <div
      class={cx(CLASS.rule, invalid() && CLASS.invalid, drag.isDragging() && CLASS.dragging, drop.position() === 'before' && CLASS.dropBefore, drop.position() === 'after' && CLASS.dropAfter)}
      title={invalid() ? r.issues().map((i) => i.message).join('\n') : undefined}
      {...drop.dropProps}
    >
      <span class={CLASS.handle} aria-label={ui.labels.drag} {...drag.handleProps}>
        ⠿
      </span>
      <select class={CLASS.field} value={r.field()} onChange={(e) => r.setField(e.currentTarget.value)}>
        <For each={ui.fieldOptions}>{(o) => <option value={o.value}>{o.label}</option>}</For>
      </select>
      <select class={CLASS.operator} value={r.operator()} onChange={(e) => r.setOperator(e.currentTarget.value as never)}>
        <For each={r.operators()}>{(o) => <option value={o.value}>{o.label}</option>}</For>
      </select>
      <Show
        when={r.ref() !== undefined}
        fallback={<Dynamic component={ui.components.ValueEditor} editor={r.editor()} def={r.def()} value={r.value()} onChange={r.setValue} invalid={invalid()} labels={ui.labels} />}
      >
        <select class={CLASS.value} value={r.ref()} onChange={(e) => r.setRef(e.currentTarget.value)}>
          <For each={refs()}>{(o) => <option value={o.value}>{o.label}</option>}</For>
        </select>
      </Show>
      <Show when={refs().length > 0}>
        <button
          type="button"
          class={CLASS.action}
          title={r.ref() === undefined ? ui.labels.compareField : ui.labels.compareValue}
          onClick={() => r.setRef(r.ref() === undefined ? refs()[0]!.value : null)}
        >
          {r.ref() === undefined ? 'ƒ' : '✎'}
        </button>
      </Show>
      <button type="button" class={CLASS.action} title={ui.labels.clone} aria-label={ui.labels.clone} onClick={r.clone}>
        ⧉
      </button>
      <button type="button" class={CLASS.action} title={ui.labels.remove} aria-label={ui.labels.remove} onClick={r.remove}>
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

export function DefaultGroup(props: { id: NodeId }) {
  const ui = useUI();
  const id = props.id;
  const g = useGroup(id);
  const drag = useDragHandle(id);
  const drop = useDropTarget(id);
  const zone = useGroupDropZone(id);
  const isRoot = g.isRoot();

  return (
    <div
      class={cx(CLASS.group, drag.isDragging() && CLASS.dragging, drop.position() === 'before' && CLASS.dropBefore, drop.position() === 'after' && CLASS.dropAfter)}
      {...(isRoot ? {} : drop.dropProps)}
    >
      <div class={CLASS.groupHeader}>
        <Show when={!isRoot}>
          <span class={CLASS.handle} aria-label={ui.labels.drag} {...drag.handleProps}>
            ⠿
          </span>
        </Show>
        <label class={CLASS.not}>
          <input type="checkbox" checked={g.not()} onChange={(e) => g.setNot(e.currentTarget.checked)} />
          {ui.labels.not}
        </label>
        <select class={CLASS.combinator} value={g.combinator()} onChange={(e) => g.setCombinator(e.currentTarget.value as 'and' | 'or')}>
          <option value="and">{ui.labels.and}</option>
          <option value="or">{ui.labels.or}</option>
        </select>
        <button type="button" class={CLASS.action} onClick={() => g.addRule()}>
          {ui.labels.addRule}
        </button>
        <button type="button" class={CLASS.action} onClick={() => g.addGroup()}>
          {ui.labels.addGroup}
        </button>
        <Show when={!isRoot}>
          <button type="button" class={CLASS.action} title={ui.labels.clone} aria-label={ui.labels.clone} onClick={g.clone}>
            ⧉
          </button>
          <button type="button" class={CLASS.action} title={ui.labels.remove} aria-label={ui.labels.remove} onClick={g.remove}>
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
  /** Controlled value in `format`'s shape. */
  value?: T;
  onChange?: (value: T) => void;
  /** Swap any built-in piece; unspecified ones keep their defaults. */
  components?: Partial<Components>;
  labels?: Partial<Labels>;
  class?: string;
}

/**
 * Ready-made builder. Pass a `store`, or `fields` (+ `initial` or `value`/`onChange`, `format`)
 * and it creates one. Store and options are read once.
 */
export function QueryBuilder<T = unknown>(props: QueryBuilderProps<T>): JSX.Element {
  // Store and options are read once, like the other bindings.
  let store = props.store;
  if (store) {
    const s = store;
    const unsub = s.subscribe(() => props.onChange?.(s.getValue()));
    createEffect(
      on(
        () => props.value,
        (v) => {
          if (v !== undefined) s.setValue(v);
        },
      ),
    );
    onCleanup(unsub);
  } else {
    if (!props.fields) throw new Error('trawlnet: <QueryBuilder> needs a `store` or `fields`');
    store = useQueryStore<Fields, T>({
      fields: props.fields,
      initial: props.initial,
      format: props.format,
      value: () => props.value,
      onChange: (v: T) => props.onChange?.(v),
    } as never);
  }
  const ui: UI = {
    labels: { ...DEFAULT_LABELS, ...props.labels },
    components: { Group: DefaultGroup, Rule: DefaultRule, ValueEditor: DefaultValueEditor, ...props.components },
    fieldOptions: fieldOptions(store.fields),
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
