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
  type NodeId,
  type Option,
  type QueryOf,
  type QueryStore,
} from '@trawlnet/core';
import { createContext, memo, useContext, useMemo, useState, useSyncExternalStore, type ComponentType, type ReactNode } from 'react';
import { useDragHandle, useDropTarget, useGroupDropZone } from './dnd';
import { QueryProvider, useGroup, useQueryStore, useRule, useStore, type UseQueryStoreOptions } from './hooks';

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
  Group: ComponentType<{ id: NodeId }>;
  Rule: ComponentType<{ id: NodeId }>;
  ValueEditor: ComponentType<ValueEditorProps>;
}

interface UI {
  labels: Labels;
  components: Components;
  fieldOptions: Option[];
}

const UIContext = createContext<UI | null>(null);
const useUI = () => useContext(UIContext)!;

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

/** An input that keeps the user's in-progress text ("1.", "3, ") while committing parsed values. */
function DraftInput({ type, value, parse, format, onChange, invalid }: { type: string; value: unknown; parse: (raw: string) => unknown; format: (v: unknown) => string; onChange: (v: unknown) => void; invalid: boolean }) {
  const [draft, setDraft] = useState(() => format(value));
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    if (format(parse(draft)) !== format(value)) setDraft(format(value));
  }
  return (
    <input
      className={CLASS.value}
      type={type}
      value={draft}
      aria-invalid={invalid || undefined}
      onChange={(e) => {
        setDraft(e.target.value);
        onChange(parse(e.target.value));
      }}
    />
  );
}

function ScalarEditor({ editor, def, value, onChange, invalid, labels }: ValueEditorProps) {
  switch (editor.type) {
    case 'boolean':
      return (
        <select className={CLASS.value} value={formatInput(value)} aria-invalid={invalid || undefined} onChange={(e) => onChange(e.target.value === '' ? null : e.target.value === 'true')}>
          <option value="">{labels.empty}</option>
          <option value="true">{labels.yes}</option>
          <option value="false">{labels.no}</option>
        </select>
      );
    case 'select':
      return (
        <select className={CLASS.value} value={formatInput(value)} aria-invalid={invalid || undefined} onChange={(e) => onChange(parseInput(def, e.target.value))}>
          <option value="">{labels.empty}</option>
          {editor.options?.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </select>
      );
    case 'number':
    case 'date':
      return <DraftInput type={editor.type} value={value} parse={(raw) => parseInput(def, raw)} format={formatInput} onChange={onChange} invalid={invalid} />;
    default:
      return <input className={CLASS.value} type="text" value={formatInput(value)} aria-invalid={invalid || undefined} onChange={(e) => onChange(e.target.value)} />;
  }
}

export function DefaultValueEditor(props: ValueEditorProps) {
  const { editor, def, value, onChange, invalid, labels } = props;
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
      if (editor.type === 'multiselect') {
        const selected = Array.isArray(value) ? value.map(String) : [];
        return (
          <select className={CLASS.value} multiple value={selected} aria-invalid={invalid || undefined} onChange={(e) => onChange([...e.target.selectedOptions].map((o) => parseInput(def, o.value)))}>
            {editor.options?.map((o) => (
              <option key={String(o.value)} value={String(o.value)}>
                {o.label}
              </option>
            ))}
          </select>
        );
      }
      return <DraftInput type="text" value={value} parse={(raw) => parseList(def, raw)} format={formatList} onChange={onChange} invalid={invalid} />;
    default:
      return <ScalarEditor {...props} />;
  }
}

export const DefaultRule = memo(function DefaultRule({ id }: { id: NodeId }) {
  const store = useStore();
  const { labels, components, fieldOptions: fields } = useUI();
  const { rule, def, editor, operators, issues, setField, setOperator, setValue, setRef, remove, clone } = useRule(id);
  const { isDragging, handleProps } = useDragHandle(id);
  const { position, dropProps } = useDropTarget(id);
  const refs = useMemo(() => (editor.allowsRef ? refOptions(store.fields, rule.field) : []), [store, editor.allowsRef, rule.field]);
  const invalid = issues.some((i) => i.severity === 'error');
  const { ValueEditor } = components;

  return (
    <div
      className={cx(CLASS.rule, invalid && CLASS.invalid, isDragging && CLASS.dragging, position === 'before' && CLASS.dropBefore, position === 'after' && CLASS.dropAfter)}
      title={invalid ? issues.map((i) => i.message).join('\n') : undefined}
      {...dropProps}
    >
      <span className={CLASS.handle} aria-label={labels.drag} {...handleProps}>
        ⠿
      </span>
      <select className={CLASS.field} value={rule.field} onChange={(e) => setField(e.target.value)}>
        {fields.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <select className={CLASS.operator} value={rule.operator} onChange={(e) => setOperator(e.target.value as typeof rule.operator)}>
        {operators.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {rule.ref !== undefined ? (
        <select className={CLASS.value} value={rule.ref} onChange={(e) => setRef(e.target.value)}>
          {refs.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <ValueEditor editor={editor} def={def} value={rule.value} onChange={setValue} invalid={invalid} labels={labels} />
      )}
      {refs.length > 0 && (
        <button
          type="button"
          className={CLASS.action}
          title={rule.ref === undefined ? labels.compareField : labels.compareValue}
          onClick={() => setRef(rule.ref === undefined ? refs[0]!.value : null)}
        >
          {rule.ref === undefined ? 'ƒ' : '✎'}
        </button>
      )}
      <button type="button" className={CLASS.action} title={labels.clone} aria-label={labels.clone} onClick={clone}>
        ⧉
      </button>
      <button type="button" className={CLASS.action} title={labels.remove} aria-label={labels.remove} onClick={remove}>
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

export const DefaultGroup = memo(function DefaultGroup({ id }: { id: NodeId }) {
  const { labels } = useUI();
  const { group, isRoot, setCombinator, setNot, addRule, addGroup, remove, clone } = useGroup(id);
  const { isDragging, handleProps } = useDragHandle(id);
  const { position, dropProps } = useDropTarget(id);
  const { isOver, zoneProps } = useGroupDropZone(id);

  return (
    <div
      className={cx(CLASS.group, isDragging && CLASS.dragging, position === 'before' && CLASS.dropBefore, position === 'after' && CLASS.dropAfter)}
      {...(isRoot ? {} : dropProps)}
    >
      <div className={CLASS.groupHeader}>
        {!isRoot && (
          <span className={CLASS.handle} aria-label={labels.drag} {...handleProps}>
            ⠿
          </span>
        )}
        <label className={CLASS.not}>
          <input type="checkbox" checked={group.not} onChange={(e) => setNot(e.target.checked)} />
          {labels.not}
        </label>
        <select className={CLASS.combinator} value={group.combinator} onChange={(e) => setCombinator(e.target.value as 'and' | 'or')}>
          <option value="and">{labels.and}</option>
          <option value="or">{labels.or}</option>
        </select>
        <button type="button" className={CLASS.action} onClick={() => addRule()}>
          {labels.addRule}
        </button>
        <button type="button" className={CLASS.action} onClick={() => addGroup()}>
          {labels.addGroup}
        </button>
        {!isRoot && (
          <>
            <button type="button" className={CLASS.action} title={labels.clone} aria-label={labels.clone} onClick={clone}>
              ⧉
            </button>
            <button type="button" className={CLASS.action} title={labels.remove} aria-label={labels.remove} onClick={remove}>
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
}

export type QueryBuilderProps<F extends Fields, T> = QueryBuilderUIProps & ({ store: QueryStore<F, T> } | (UseQueryStoreOptions<F, T> & { store?: undefined }));

function Shell({ store, components, labels, className }: QueryBuilderUIProps & { store: QueryStore<any, any> }) {
  const ui = useMemo<UI>(
    () => ({
      labels: { ...DEFAULT_LABELS, ...labels },
      components: { Group: DefaultGroup, Rule: DefaultRule, ValueEditor: DefaultValueEditor, ...components },
      fieldOptions: fieldOptions(store.fields),
    }),
    [store, components, labels],
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
  return <Shell store={store} components={props.components} labels={props.labels} className={props.className} />;
}

/**
 * Ready-made builder. Give it a `store` you created with `useQueryStore`, or store options
 * (`fields`, `initial` or `value`/`onChange`, `format`) and it creates one for you.
 */
export function QueryBuilder<const F extends Fields, T = QueryOf<F>>(props: QueryBuilderProps<F, T>): ReactNode {
  if (props.store) return <Shell {...props} store={props.store} />;
  return <OwnStore {...(props as UseQueryStoreOptions<F, T> & QueryBuilderUIProps)} />;
}
