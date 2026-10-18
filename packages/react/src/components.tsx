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
  type NodeId,
  type Operand,
  type Option,
  type Quantifier,
  type QueryOf,
  type QueryStore,
} from '@trawlnet/core';
import { createContext, memo, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ComponentType, type ReactNode } from 'react';
import { useDragHandle, useDropTarget, useGroupDropZone } from './dnd';
import { QueryProvider, useGroup, useQueryStore, useRule, useStore, type UseQueryStoreOptions } from './hooks';

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
  Group: ComponentType<{ id: NodeId }>;
  Rule: ComponentType<{ id: NodeId }>;
  ValueEditor: ComponentType<ValueEditorProps>;
}

interface UI {
  labels: Labels;
  components: Components;
  showNot: boolean;
  showLock: boolean;
}

const UIContext = createContext<UI | null>(null);
const useUI = () => useContext(UIContext)!;

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

/** An input that keeps the user's in-progress text ("1.", "3, ") while committing parsed values. */
function DraftInput({ type, value, parse, format, onChange, invalid, disabled, ...rest }: { type: string; value: unknown; parse: (raw: string) => unknown; format: (v: unknown) => string; onChange: (v: unknown) => void; invalid: boolean; disabled?: boolean; min?: number; max?: number; step?: number; placeholder?: string }) {
  const [draft, setDraft] = useState(() => format(value));
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    if (format(parse(draft)) !== format(value)) setDraft(format(value));
  }
  return (
    <input
      {...rest}
      className={CLASS.value}
      type={type}
      value={draft}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      onChange={(e) => {
        setDraft(e.target.value);
        onChange(parse(e.target.value));
      }}
    />
  );
}

const indent = (depth: number) => '  '.repeat(depth);

function OptionList({ editor }: { editor: EditorSpec }) {
  return (
    <>
      {editor.options?.map((o) => (
        <option key={String(o.value)} value={String(o.value)} disabled={o.disabled}>
          {indent(o.depth) + o.label}
        </option>
      ))}
    </>
  );
}

/** Text input backed by the field's async `search`, suggesting options as the user types. */
function AsyncInput({ def, value, onChange, invalid, disabled, multiple }: { def: AnyFieldDef | undefined; value: unknown; onChange: (v: unknown) => void; invalid: boolean; disabled?: boolean; multiple?: boolean }) {
  const format = multiple ? formatList : formatInput;
  const [query, setQuery] = useState(() => format(value));
  const [options, setOptions] = useState<{ value: unknown; label: string }[]>([]);
  // Follow external value changes (undo, controlled updates) without clobbering the text the user
  // is typing: only reset when the new value isn't what this input last emitted.
  const [prev, setPrev] = useState(value);
  const [emitted, setEmitted] = useState(value);
  if (prev !== value) {
    setPrev(value);
    if (format(value) !== format(emitted)) setQuery(format(value));
  }
  const listId = useMemo(() => `tn-async-${Math.random().toString(36).slice(2)}`, []);
  useEffect(() => {
    if (!def?.search) return;
    const ctrl = new AbortController();
    const term = multiple ? (query.split(',').pop() ?? '').trim() : query;
    const t = setTimeout(() => void def.search!(term, ctrl.signal).then((o) => setOptions([...o]), () => {}), 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [def, query, multiple]);
  return (
    <>
      <input
        className={CLASS.value}
        list={listId}
        value={query}
        disabled={disabled}
        aria-invalid={invalid || undefined}
        onChange={(e) => {
          setQuery(e.target.value);
          const next = multiple ? parseList({ ...def!, options: options as never }, e.target.value) : (options.find((o) => String(o.value) === e.target.value)?.value ?? (def?.allowCustom ? e.target.value : null));
          setEmitted(next);
          onChange(next);
        }}
      />
      <datalist id={listId}>
        {options.map((o) => (
          <option key={String(o.value)} value={String(o.value)}>
            {o.label}
          </option>
        ))}
      </datalist>
    </>
  );
}

function ScalarEditor({ editor, def, value, onChange, invalid, disabled, labels }: ValueEditorProps) {
  if (editor.async) return <AsyncInput def={def} value={value} onChange={onChange} invalid={invalid} disabled={disabled} />;
  const aria = { 'aria-invalid': invalid || undefined, disabled };
  switch (editor.type) {
    case 'boolean':
      return (
        <select className={CLASS.value} value={formatInput(value)} {...aria} onChange={(e) => onChange(e.target.value === '' ? null : e.target.value === 'true')}>
          <option value="">{labels.empty}</option>
          <option value="true">{labels.yes}</option>
          <option value="false">{labels.no}</option>
        </select>
      );
    case 'select':
      return (
        <select className={CLASS.value} value={formatInput(value)} {...aria} onChange={(e) => onChange(parseInput(def, e.target.value))}>
          <option value="">{labels.empty}</option>
          <OptionList editor={editor} />
        </select>
      );
    case 'number':
      return <DraftInput type="number" value={value} min={def?.min} max={def?.max} step={def?.step} placeholder={def?.placeholder} parse={(raw) => parseInput(def, raw)} format={formatInput} onChange={onChange} invalid={invalid} disabled={disabled} />;
    case 'slider':
      return (
        <span className="tn-slider">
          <input
            className={CLASS.value}
            type="range"
            min={def?.min ?? 0}
            max={def?.max ?? 100}
            step={def?.step ?? 1}
            value={typeof value === 'number' ? value : (def?.min ?? 0)}
            {...aria}
            onChange={(e) => onChange(Number(e.target.value))}
          />
          <output>{formatInput(value)}</output>
        </span>
      );
    case 'date':
    case 'time':
      return <DraftInput type={editor.type} value={value} parse={(raw) => parseInput(def, raw)} format={formatInput} onChange={onChange} invalid={invalid} disabled={disabled} />;
    case 'datetime':
      return <DraftInput type="datetime-local" value={value} parse={(raw) => parseInput(def, raw)} format={(v) => formatInput(v).slice(0, 16)} onChange={onChange} invalid={invalid} disabled={disabled} />;
    case 'textarea':
      return <textarea className={CLASS.value} rows={2} value={formatInput(value)} placeholder={def?.placeholder} {...aria} onChange={(e) => onChange(e.target.value)} />;
    default:
      return <input className={CLASS.value} type="text" value={formatInput(value)} placeholder={def?.placeholder} {...aria} onChange={(e) => onChange(e.target.value)} />;
  }
}

export function DefaultValueEditor(props: ValueEditorProps) {
  const { editor, def, value, onChange, invalid, disabled, labels } = props;
  switch (editor.arity) {
    case 'none':
      return null;
    case 'two': {
      const pair = Array.isArray(value) ? value : [null, null];
      return (
        <span className="tn-value-pair">
          <ScalarEditor {...props} value={pair[0]} onChange={(v) => onChange([v, pair[1]])} />
          <span>{labels.rangeSeparator}</span>
          <ScalarEditor {...props} value={pair[1]} onChange={(v) => onChange([pair[0], v])} />
        </span>
      );
    }
    case 'many':
      if (editor.async) return <AsyncInput def={def} value={value} onChange={onChange} invalid={invalid} disabled={disabled} multiple />;
      if (editor.type === 'multiselect') {
        const selected = Array.isArray(value) ? value.map(String) : [];
        return (
          <select className={CLASS.value} multiple value={selected} disabled={disabled} aria-invalid={invalid || undefined} onChange={(e) => onChange([...e.target.selectedOptions].map((o) => parseInput(def, o.value)))}>
            <OptionList editor={editor} />
          </select>
        );
      }
      return <DraftInput type="text" value={value} parse={(raw) => parseList(def, raw)} format={formatList} onChange={onChange} invalid={invalid} disabled={disabled} />;
    default:
      return <ScalarEditor {...props} />;
  }
}

function Select({ value, options, onChange, className, disabled, placeholder }: { value: string; options: readonly Option[]; onChange: (v: string) => void; className?: string; disabled?: boolean; placeholder?: string }) {
  return (
    <select className={className} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

/** Field picker with struct fields grouped under their struct label. */
function FieldSelect({ value, options, onChange, disabled }: { value: string; options: readonly FieldOption[]; onChange: (v: string) => void; disabled?: boolean }) {
  const groups = useMemo(() => {
    const out = new Map<string | undefined, FieldOption[]>();
    for (const o of options) out.set(o.group, [...(out.get(o.group) ?? []), o]);
    return [...out];
  }, [options]);
  const render = (o: FieldOption) => (
    <option key={o.value} value={o.value} title={o.description}>
      {o.label}
    </option>
  );
  return (
    <select className={CLASS.field} value={value} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      {groups.map(([group, opts]) =>
        group === undefined ? (
          opts.map(render)
        ) : (
          <optgroup key={group} label={group}>
            {opts.map(render)}
          </optgroup>
        ),
      )}
    </select>
  );
}

/** Editor for a function call: pick the function, then each argument (literal, field, or nested call). */
export function FunctionEditor({ call, fields, kind, onChange, disabled, labels }: { call: FnCall; fields: Fields; kind?: string; onChange: (c: FnCall) => void; disabled?: boolean; labels: Labels }) {
  const fns = useMemo(() => functionOptions(fields, kind), [fields, kind]);
  const def = functionOf(fields, call);
  return (
    <span className="tn-function">
      <Select className="tn-function-name" value={call.fn} options={fns} disabled={disabled} onChange={(fn) => onChange(defaultCall(fields, fn))} />
      {def && Object.keys(def.args).length > 0 && (
        <span className="tn-function-args">
          (
          {Object.entries(def.args).map(([name, argDef], i) => (
            <span key={name} className="tn-function-arg">
              {i > 0 && ', '}
              <OperandEditor
                operand={call.args[name] ?? { value: null }}
                def={argDef}
                fields={fields}
                label={fieldLabel(name, argDef)}
                disabled={disabled}
                labels={labels}
                onChange={(operand) => onChange({ ...call, args: { ...call.args, [name]: operand } })}
              />
            </span>
          ))}
          )
        </span>
      )}
    </span>
  );
}

function OperandEditor({ operand, def, fields, label, onChange, disabled, labels }: { operand: Operand; def: AnyFieldDef; fields: Fields; label: string; onChange: (o: Operand) => void; disabled?: boolean; labels: Labels }) {
  const refs = refOptions(fields, '', def.kind);
  const nested = functionOptions(fields, def.kind);
  const source = isFnCall(operand) ? 'function' : 'ref' in operand ? 'field' : 'value';
  return (
    <span className="tn-operand" title={label}>
      {(refs.length > 0 || nested.length > 0) && (
        <select
          className="tn-source"
          value={source}
          disabled={disabled}
          onChange={(e) =>
            onChange(e.target.value === 'field' ? { ref: refs[0]!.value } : e.target.value === 'function' ? defaultCall(fields, nested[0]!.value) : { value: def.defaultValue ?? null })
          }
        >
          <option value="value">{label}</option>
          {refs.length > 0 && <option value="field">{label}: field</option>}
          {nested.length > 0 && <option value="function">{label}: ƒ</option>}
        </select>
      )}
      {isFnCall(operand) ? (
        <FunctionEditor call={operand} fields={fields} kind={def.kind} onChange={onChange} disabled={disabled} labels={labels} />
      ) : 'ref' in operand ? (
        <Select className={CLASS.value} value={operand.ref} options={refs} disabled={disabled} onChange={(ref) => onChange({ ref })} />
      ) : (
        <ScalarEditor editor={editorFor(def, 'eq', fields)} def={def} value={operand.value} invalid={false} disabled={disabled} labels={labels} onChange={(value) => onChange({ value })} />
      )}
    </span>
  );
}

export const DefaultRule = memo(function DefaultRule({ id }: { id: NodeId }) {
  const store = useStore();
  const { labels, components, showLock } = useUI();
  const r = useRule(id);
  const { rule, fields, def, editor, issues, can, source, locked } = r;
  const { isDragging, handleProps } = useDragHandle(id);
  const { position, dropProps } = useDropTarget(id);
  const invalid = issues.some((i) => i.severity === 'error');
  const lhsFunctions = useMemo(() => (store.settings.allowFunctions !== false ? functionOptions(fields) : []), [store, fields]);
  const { ValueEditor } = components;
  const fieldIsFn = isFnCall(rule.field);

  return (
    <div
      className={cx(CLASS.rule, invalid && CLASS.invalid, locked && CLASS.locked, isDragging && CLASS.dragging, position === 'before' && CLASS.dropBefore, position === 'after' && CLASS.dropAfter)}
      title={invalid ? issues.map((i) => i.message).join('\n') : undefined}
      {...dropProps}
    >
      <span className={CLASS.handle} aria-label={labels.drag} {...handleProps}>
        ⠿
      </span>
      {lhsFunctions.length > 0 && (
        <button
          type="button"
          className={cx(CLASS.action, 'tn-lhs-toggle')}
          disabled={!can.editField}
          title={fieldIsFn ? labels.useField : labels.useFunction}
          aria-pressed={fieldIsFn}
          onClick={() => r.setField(fieldIsFn ? r.fieldOptions[0]!.value : defaultCall(fields, lhsFunctions[0]!.value))}
        >
          ƒ
        </button>
      )}
      {isFnCall(rule.field) ? (
        <FunctionEditor call={rule.field} fields={fields} onChange={r.setField} disabled={!can.editField} labels={labels} />
      ) : (
        <FieldSelect value={rule.field} options={r.fieldOptions} disabled={!can.editField} onChange={r.setField} />
      )}
      <Select className={CLASS.operator} value={rule.operator} options={r.operators} disabled={!can.editOperator} onChange={r.setOperator} />
      {(r.refOptions.length > 0 || r.functionOptions.length > 0) && (
        <select
          className="tn-source"
          value={source}
          disabled={!can.editValue}
          aria-label={labels.compareWith}
          onChange={(e) =>
            e.target.value === 'field' ? r.setRef(r.refOptions[0]!.value) : e.target.value === 'function' ? r.setCall(defaultCall(fields, r.functionOptions[0]!.value)) : r.setRef(null)
          }
        >
          <option value="value">{labels.compareValue}</option>
          {r.refOptions.length > 0 && <option value="field">{labels.compareField}</option>}
          {r.functionOptions.length > 0 && <option value="function">{labels.compareFunction}</option>}
        </select>
      )}
      {rule.ref !== undefined ? (
        <Select className={CLASS.value} value={rule.ref} options={r.refOptions} disabled={!can.editValue} onChange={r.setRef} />
      ) : rule.call !== undefined ? (
        <FunctionEditor call={rule.call} fields={fields} kind={def?.kind} onChange={r.setCall} disabled={!can.editValue} labels={labels} />
      ) : (
        <ValueEditor editor={editor} def={def} value={rule.value} onChange={r.setValue} invalid={invalid} disabled={!can.editValue} labels={labels} />
      )}
      {showLock && (
        <button type="button" className={CLASS.action} disabled={!can.lock} aria-pressed={!!rule.locked} title={rule.locked ? labels.unlock : labels.lock} onClick={() => r.setLocked(!rule.locked)}>
          {rule.locked ? '🔒' : '🔓'}
        </button>
      )}
      <button type="button" className={CLASS.action} title={labels.clone} aria-label={labels.clone} disabled={!can.clone} onClick={r.clone}>
        ⧉
      </button>
      <button type="button" className={CLASS.action} title={labels.remove} aria-label={labels.remove} disabled={!can.remove} onClick={r.remove}>
        ×
      </button>
    </div>
  );
});

function NodeView({ id }: { id: NodeId }) {
  const store = useStore();
  const { components } = useUI();
  const kind = useSyncExternalStore(
    useMemo(() => (fn: () => void) => store.subscribe(id, fn), [store, id]),
    () => store.get(id)?.kind,
  );
  return kind === 'group' ? <components.Group id={id} /> : <components.Rule id={id} />;
}

/** "some / all / none / at least N of Orders where …" for array groups. */
function MatchEditor({ match, label, onChange, disabled, labels }: { match: Quantifier; label: string; onChange: (m: Quantifier) => void; disabled?: boolean; labels: Labels }) {
  const mode = typeof match === 'string' ? match : 'count';
  return (
    <span className="tn-match">
      <select
        className="tn-match-mode"
        value={mode}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === 'count' ? { count: 'gte', value: 1 } : (e.target.value as 'some' | 'all' | 'none'))}
      >
        <option value="some">{labels.some}</option>
        <option value="all">{labels.all}</option>
        <option value="none">{labels.none}</option>
        <option value="count">{labels.count}</option>
      </select>
      {typeof match === 'object' && match.count !== 'between' && (
        <>
          <Select className="tn-match-op" value={match.count} options={countOptions(labels)} disabled={disabled} onChange={(count) => onChange({ count: count as 'gte', value: match.value })} />
          <input className="tn-match-count" type="number" min={0} value={match.value} disabled={disabled} onChange={(e) => onChange({ count: match.count, value: Number(e.target.value) })} />
        </>
      )}
      <span>
        {labels.matchOf} <strong>{label}</strong> {labels.matchWhere}
      </span>
    </span>
  );
}

export const DefaultGroup = memo(function DefaultGroup({ id }: { id: NodeId }) {
  const store = useStore();
  const { labels, showNot, showLock } = useUI();
  const g = useGroup(id);
  const { group, isRoot, can, locked } = g;
  const { isDragging, handleProps } = useDragHandle(id);
  const { position, dropProps } = useDropTarget(id);
  const { isOver, zoneProps } = useGroupDropZone(id);
  const arrayLabel = group.of ? fieldLabel(group.of.field, (isRoot ? store.fields : store.fieldsFor(id))[group.of.field]) : '';

  return (
    <div
      className={cx(CLASS.group, group.of && CLASS.arrayGroup, locked && CLASS.locked, isDragging && CLASS.dragging, position === 'before' && CLASS.dropBefore, position === 'after' && CLASS.dropAfter)}
      {...(isRoot ? {} : dropProps)}
    >
      <div className={CLASS.groupHeader}>
        {!isRoot && (
          <span className={CLASS.handle} aria-label={labels.drag} {...handleProps}>
            ⠿
          </span>
        )}
        {group.of && <MatchEditor match={group.of.match} label={arrayLabel} onChange={g.setMatch} disabled={!can.editGroup} labels={labels} />}
        {showNot && (
          <label className={CLASS.not}>
            <input type="checkbox" checked={group.not} disabled={!can.editGroup} onChange={(e) => g.setNot(e.target.checked)} />
            {labels.not}
          </label>
        )}
        <select className={CLASS.combinator} value={group.combinator} disabled={!can.editGroup} onChange={(e) => g.setCombinator(e.target.value as 'and' | 'or')}>
          <option value="and">{labels.and}</option>
          <option value="or">{labels.or}</option>
        </select>
        <button type="button" className={CLASS.action} disabled={!can.addRule} onClick={() => g.addRule()}>
          {labels.addRule}
        </button>
        <button type="button" className={CLASS.action} disabled={!can.addGroup} onClick={() => g.addGroup()}>
          {labels.addGroup}
        </button>
        {g.arrayFields.length > 0 && (
          <select className="tn-add-array" value="" disabled={!can.addGroup} onChange={(e) => e.target.value && g.addArrayGroup(e.target.value)}>
            <option value="">{labels.addArrayGroup}</option>
            {g.arrayFields.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        )}
        {showLock && (
          <button type="button" className={CLASS.action} disabled={!can.lock} aria-pressed={!!group.locked} title={group.locked ? labels.unlock : labels.lock} onClick={() => g.setLocked(!group.locked)}>
            {group.locked ? '🔒' : '🔓'}
          </button>
        )}
        {!isRoot && (
          <>
            <button type="button" className={CLASS.action} title={labels.clone} aria-label={labels.clone} disabled={!can.clone} onClick={g.clone}>
              ⧉
            </button>
            <button type="button" className={CLASS.action} title={labels.remove} aria-label={labels.remove} disabled={!can.remove} onClick={g.remove}>
              ×
            </button>
          </>
        )}
      </div>
      <div className={cx(CLASS.children, isOver && CLASS.dropInside)} {...zoneProps}>
        {group.children.map((c) => (
          <NodeView key={c} id={c} />
        ))}
      </div>
    </div>
  );
});

export interface QueryBuilderUIProps {
  /** Swap any built-in piece; unspecified ones keep their defaults. */
  components?: Partial<Components>;
  labels?: Partial<Labels>;
  className?: string;
  /** Show the NOT toggle on groups (default true). RAQB showNot. */
  showNot?: boolean;
  /** Show lock toggles on rules and groups (default false). RAQB showLock. */
  showLock?: boolean;
}

export type QueryBuilderProps<F extends Fields, T> = QueryBuilderUIProps & ({ store: QueryStore<F, T> } | (UseQueryStoreOptions<F, T> & { store?: undefined }));

function Shell({ store, components, labels, className, showNot = true, showLock = false }: QueryBuilderUIProps & { store: QueryStore<any, any> }) {
  const ui = useMemo<UI>(
    () => ({
      labels: { ...DEFAULT_LABELS, ...labels },
      components: { Group: DefaultGroup, Rule: DefaultRule, ValueEditor: DefaultValueEditor, ...components },
      showNot,
      showLock,
    }),
    [components, labels, showNot, showLock],
  );
  return (
    <QueryProvider store={store}>
      <UIContext.Provider value={ui}>
        <div className={cx(CLASS.root, className)}>
          <ui.components.Group id={store.rootId} />
        </div>
      </UIContext.Provider>
    </QueryProvider>
  );
}

function OwnStore<F extends Fields, T>(props: UseQueryStoreOptions<F, T> & QueryBuilderUIProps) {
  const store = useQueryStore<F, T>(props);
  return <Shell store={store} components={props.components} labels={props.labels} className={props.className} showNot={props.showNot} showLock={props.showLock} />;
}

/**
 * Ready-made builder. Give it a `store` you created with `useQueryStore`, or store options
 * (`fields`, `initial` or `value`/`onChange`, `format`, `settings`) and it creates one for you.
 */
export function QueryBuilder<const F extends Fields, T = QueryOf<F>>(props: QueryBuilderProps<F, T>): ReactNode {
  if (props.store) return <Shell {...props} store={props.store} />;
  return <OwnStore {...(props as UseQueryStoreOptions<F, T> & QueryBuilderUIProps)} />;
}
