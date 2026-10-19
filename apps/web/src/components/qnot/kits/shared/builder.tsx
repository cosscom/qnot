// Part of qnot (https://github.com/cosscom/qnot). MIT licensed; installable with shadcn.
// A UI-kit-agnostic qnot query builder: every behaviour lives here, built only on
// @qnot/react's headless hooks; the look comes from the Kit it is given (./kit.ts). Feature for
// feature it matches the coss builder and @qnot/react's default UI: grouped struct fields,
// value sources, functions on either side, array groups, locks and permission-driven disabling.
// Rows subscribe to their own node only, so a keystroke re-renders one rule. MIT licensed.
'use client';

import {
  countOptions,
  defaultCall,
  editorFor,
  fieldLabel,
  formatList,
  functionOf,
  functionOptions,
  isFnCall,
  parseInput,
  parseList,
  refOptions as refOptionsOf,
  type AnyFieldDef,
  type EditorSpec,
  type EnumOption,
  type Fields,
  type FnCall,
  type NodeId,
  type Operand,
  type Quantifier,
  type QueryStore,
} from '@qnot/core';
import { QueryProvider, useDragHandle, useDropTarget, useGroup, useGroupDropZone, useNode, useRule, useSettings, useStore } from '@qnot/react';
import { createContext, memo, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Item, Kit, Width } from '@/components/qnot/kits/shared/kit';

export interface QueryBuilderOptions {
  /** `toggle`: NOT + AND/OR controls. `sentence`: "If [all | any | none] of these rules are met". */
  combinatorStyle?: 'toggle' | 'sentence';
  /** Full-width rule rows with only field, operator, value and remove (no drag, duplicate or sources). */
  compact?: boolean;
  /** Offer "+ Group" (nested groups). Default true. */
  allowGroups?: boolean;
  /** Show the NOT toggle on groups (default true). */
  showNot?: boolean;
  /** Show lock toggles on rules and groups (default false). */
  showLock?: boolean;
  /** Icon shown before the sentence header. */
  sentenceIcon?: ReactNode;
  labels?: Partial<Labels>;
}

export const DEFAULT_LABELS = {
  addRule: 'Rule',
  addGroup: 'Group',
  addArrayGroup: 'List condition',
  field: 'Select a field',
  value: 'Choose…',
  valueText: 'Enter a value',
  sentenceBefore: 'If',
  sentenceAfter: 'of these rules are met',
  empty: 'Empty group: add a rule or drag one here.',
  lock: 'Lock',
  unlock: 'Unlock',
  and: 'and',
  of: 'of',
  where: 'where',
  countGte: 'at least',
  countLte: 'at most',
  countEq: 'exactly',
  countGt: 'more than',
  countLt: 'fewer than',
};
export type Labels = typeof DEFAULT_LABELS;

interface Ctx extends Required<Omit<QueryBuilderOptions, 'sentenceIcon' | 'labels'>> {
  kit: Kit;
  labels: Labels;
  sentenceIcon: ReactNode;
}
const OptionsContext = createContext<Ctx>(null!);
const useOptions = () => useContext(OptionsContext);

type Source = 'value' | 'field' | 'function';

const toItems = (options: EditorSpec['options'] | readonly EnumOption<unknown>[] | undefined): Item[] =>
  (options ?? []).map((o) => ({
    value: String(o.value),
    label: o.label,
    raw: o.value,
    ...('depth' in o && o.depth ? { depth: o.depth as number } : {}),
    ...('disabled' in o && o.disabled ? { disabled: true } : {}),
  }));

// --- value editors --------------------------------------------------------------------------------

interface ValueProps {
  editor: EditorSpec;
  def: AnyFieldDef | undefined;
  value: unknown;
  onChange: (v: unknown) => void;
  invalid: boolean;
  disabled?: boolean;
  fluid?: boolean;
  placeholder?: string;
  textPlaceholder?: string;
}

/** Options from a field's async `search`, re-queried (debounced, abortable) as the user types. */
function useAsyncOptions(def: AnyFieldDef | undefined) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(false);
  const labels = useRef(new Map<string, string>());
  useEffect(() => {
    if (!def?.search) return;
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(() => {
      def.search!(query, ctrl.signal).then(
        (opts) => {
          const next = opts.map((o) => ({ value: String(o.value), label: o.label, raw: o.value }));
          next.forEach((i) => labels.current.set(i.value, i.label));
          setItems(next);
          setLoading(false);
        },
        () => {},
      );
    }, 150);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [def, query]);
  const itemOf = (v: unknown): Item => ({ value: String(v), label: labels.current.get(String(v)) ?? String(v), raw: v });
  return { items, loading, setQuery, itemOf };
}

function AsyncEditor({ def, value, onChange, multiple, invalid, disabled, fluid, placeholder }: ValueProps & { multiple?: boolean }) {
  const { kit } = useOptions();
  const { items, loading, setQuery, itemOf } = useAsyncOptions(def);
  const selected = multiple ? (Array.isArray(value) ? value.map(itemOf) : []) : value === null || value === undefined || value === '' ? [] : [itemOf(value)];
  return (
    <kit.AsyncSelect
      multiple={multiple}
      items={items}
      loading={loading}
      onQueryChange={setQuery}
      value={selected}
      allowCustom={def?.allowCustom}
      onChange={(next) => onChange(multiple ? next.map((i) => i.raw ?? i.value) : next[0] ? (next[0].raw ?? next[0].value) : null)}
      invalid={invalid}
      disabled={disabled}
      placeholder={placeholder ?? 'Search…'}
      width={fluid ? 'full' : 'lg'}
    />
  );
}

/** Free-text list for `in`/`notIn` on fields without options: keeps "1, 2, " while typing. */
function ListEditor({ def, value, onChange, invalid, disabled, fluid }: ValueProps) {
  const { kit } = useOptions();
  const [draft, setDraft] = useState(() => formatList(value));
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    if (formatList(parseList(def, draft)) !== formatList(value)) setDraft(formatList(value));
  }
  return (
    <kit.TextInput
      value={draft}
      placeholder="a, b, c"
      invalid={invalid}
      disabled={disabled}
      width={fluid ? 'full' : 'lg'}
      onChange={(v) => {
        setDraft(v);
        onChange(parseList(def, v));
      }}
    />
  );
}

function ScalarEditor(props: ValueProps) {
  const { kit } = useOptions();
  const { editor, def, value, onChange, invalid, disabled, fluid, placeholder, textPlaceholder } = props;
  const w = (n: Width): Width => (fluid ? 'full' : n);
  if (editor.async) return <AsyncEditor {...props} />;
  switch (editor.type) {
    case 'boolean':
      return <kit.Switch checked={value === true} disabled={disabled} label={value === true ? 'true' : 'false'} onChange={(c) => onChange(c)} />;
    case 'select': {
      const items = toItems(editor.options);
      return (
        <kit.Select
          items={items}
          value={value === null || value === undefined ? null : String(value)}
          onChange={(v) => onChange(items.find((i) => i.value === v)?.raw ?? parseInput(def, v))}
          invalid={invalid}
          disabled={disabled}
          placeholder={placeholder ?? 'Choose…'}
          width={w('md')}
        />
      );
    }
    case 'number':
      return (
        <kit.NumberInput
          value={typeof value === 'number' ? value : null}
          min={def?.min}
          max={def?.max}
          step={def?.step}
          prefix={def?.prefix}
          suffix={def?.suffix}
          placeholder={def?.placeholder}
          invalid={invalid}
          disabled={disabled}
          width={w('sm')}
          onChange={onChange}
        />
      );
    case 'slider': {
      const min = def?.min ?? 0;
      const max = def?.max ?? 100;
      return <kit.Slider value={typeof value === 'number' ? value : min} min={min} max={max} step={def?.step ?? 1} disabled={disabled} label={def?.label ?? 'Value'} onChange={onChange} />;
    }
    case 'date':
    case 'time':
      return <kit.TextInput type={editor.type} value={typeof value === 'string' ? value : ''} invalid={invalid} disabled={disabled} width={w(editor.type === 'time' ? 'sm' : 'md')} onChange={(v) => onChange(v || null)} />;
    case 'datetime':
      return <kit.TextInput type="datetime-local" value={typeof value === 'string' ? value.slice(0, 16) : ''} invalid={invalid} disabled={disabled} width={w('lg')} onChange={(v) => onChange(v || null)} />;
    case 'textarea':
      return <kit.Textarea value={typeof value === 'string' ? value : ''} placeholder={def?.placeholder ?? textPlaceholder} invalid={invalid} disabled={disabled} width={w('lg')} onChange={onChange} />;
    default:
      return <kit.TextInput value={typeof value === 'string' ? value : ''} placeholder={def?.placeholder ?? textPlaceholder} invalid={invalid} disabled={disabled} width={w('md')} onChange={onChange} />;
  }
}

function ValueEditor(props: ValueProps) {
  const { kit, labels } = useOptions();
  const { editor, def, value, onChange, invalid, disabled, fluid } = props;
  if (editor.arity === 'none') return null;
  if (editor.arity === 'two') {
    const pair = Array.isArray(value) ? value : [null, null];
    return (
      <span className={fluid ? 'flex w-full items-center gap-2' : 'inline-flex items-center gap-2'}>
        <ScalarEditor {...props} value={pair[0]} onChange={(v) => onChange([v, pair[1]])} />
        <kit.Muted>{labels.and}</kit.Muted>
        <ScalarEditor {...props} value={pair[1]} onChange={(v) => onChange([pair[0], v])} />
      </span>
    );
  }
  if (editor.arity === 'many') {
    if (editor.async) return <AsyncEditor {...props} multiple />;
    if (editor.type !== 'multiselect') return <ListEditor {...props} />;
    const items = toItems(editor.options);
    return (
      <kit.MultiSelect
        items={items}
        value={Array.isArray(value) ? value.map(String) : []}
        onChange={(vs) => onChange(vs.map((v) => items.find((i) => i.value === v)?.raw ?? parseInput(def, v)))}
        invalid={invalid}
        disabled={disabled}
        placeholder={props.placeholder ?? 'Choose…'}
        width={fluid ? 'full' : 'lg'}
      />
    );
  }
  return <ScalarEditor {...props} />;
}

// --- value sources and functions --------------------------------------------------------------------

const SOURCE_LABEL: Record<Source, string> = { value: 'Compare with a value', field: 'Compare with another field', function: 'Compare with a function' };

function SourceSwitch({ value, available, onChange, disabled }: { value: Source; available: readonly Source[]; onChange: (s: Source) => void; disabled?: boolean }) {
  const { kit } = useOptions();
  if (available.length < 2) return null;
  const icon = { value: kit.icons.value, field: kit.icons.field, function: kit.icons.fn };
  return (
    <kit.Segmented
      compact
      label="Compare with"
      value={value}
      disabled={disabled}
      onChange={(s) => onChange(s as Source)}
      items={available.map((s) => ({ value: s, label: icon[s], tooltip: SOURCE_LABEL[s], ariaLabel: SOURCE_LABEL[s] }))}
    />
  );
}

/** A function call, rendered like `lowercase( [Name ▾] )`; arguments nest. */
function FunctionEditor({ call, fields, kind, onChange, disabled }: { call: FnCall; fields: Fields; kind?: string; onChange: (c: FnCall) => void; disabled?: boolean }) {
  const { kit } = useOptions();
  const fns = useMemo(() => functionOptions(fields, kind).map((o) => ({ value: o.value, label: o.label })), [fields, kind]);
  const def = functionOf(fields, call);
  const args = Object.entries(def?.args ?? {});
  return (
    <kit.FunctionFrame fn={call.fn}>
      <kit.Select mono items={fns} value={call.fn} disabled={disabled} width="sm" label="Function" onChange={(fn) => onChange(defaultCall(fields, fn))} />
      <kit.Muted mono>(</kit.Muted>
      {args.map(([name, argDef], i) => (
        <span key={name} className="inline-flex items-center gap-1">
          {i > 0 && <kit.Muted mono>,</kit.Muted>}
          <OperandEditor
            operand={call.args[name] ?? { value: null }}
            def={argDef}
            fields={fields}
            label={fieldLabel(name, argDef)}
            disabled={disabled}
            onChange={(operand) => onChange({ ...call, args: { ...call.args, [name]: operand } })}
          />
        </span>
      ))}
      <kit.Muted mono>)</kit.Muted>
    </kit.FunctionFrame>
  );
}

/** One function argument: a literal, another field, or a nested call, with a small source menu. */
function OperandEditor({ operand, def, fields, label, onChange, disabled }: { operand: Operand; def: AnyFieldDef; fields: Fields; label: string; onChange: (o: Operand) => void; disabled?: boolean }) {
  const { kit } = useOptions();
  const refs = useMemo(() => refOptionsOf(fields, '', def.kind).map((o) => ({ value: o.value, label: o.label })), [fields, def.kind]);
  const nested = useMemo(() => functionOptions(fields, def.kind), [fields, def.kind]);
  const source: Source = isFnCall(operand) ? 'function' : 'ref' in operand ? 'field' : 'value';
  const available: Source[] = ['value', ...(refs.length ? (['field'] as const) : []), ...(nested.length ? (['function'] as const) : [])];
  const icon = { value: kit.icons.value, field: kit.icons.field, function: kit.icons.fn }[source];
  return (
    <span className="inline-flex items-center gap-1">
      {available.length > 1 && (
        <kit.Menu
          trigger={{ label: `${label} source`, icon, iconOnly: true, tooltip: `${label}: ${source}` }}
          value={source}
          disabled={disabled}
          items={available.map((s) => ({ value: s, label: s === 'value' ? `${label} (value)` : s === 'field' ? 'Another field' : 'A function' }))}
          onSelect={(s) => onChange(s === 'field' ? { ref: refs[0]!.value } : s === 'function' ? defaultCall(fields, nested[0]!.value) : { value: def.defaultValue ?? null })}
        />
      )}
      {isFnCall(operand) ? (
        <FunctionEditor call={operand} fields={fields} kind={def.kind} onChange={onChange} disabled={disabled} />
      ) : 'ref' in operand ? (
        <kit.Select items={refs} value={operand.ref} disabled={disabled} width="sm" label={label} onChange={(ref) => onChange({ ref })} />
      ) : (
        <ScalarEditor editor={editorFor(def, 'eq', fields)} def={def} value={operand.value} invalid={false} disabled={disabled} placeholder={label} textPlaceholder={label} onChange={(value) => onChange({ value })} />
      )}
    </span>
  );
}

// --- rules ------------------------------------------------------------------------------------------

function LockToggle({ locked, disabled, onChange, what }: { locked: boolean; disabled: boolean; onChange: (l: boolean) => void; what: string }) {
  const { kit, labels } = useOptions();
  return (
    <kit.Tooltip label={locked ? `${labels.unlock} ${what}` : `${labels.lock} ${what}: no edits, moves or removal`}>
      <kit.IconButton label={locked ? labels.unlock : labels.lock} pressed={locked} icon={locked ? kit.icons.lock : kit.icons.unlock} disabled={disabled} onClick={() => onChange(!locked)} />
    </kit.Tooltip>
  );
}

function DragHandle({ handleProps }: { handleProps: object }) {
  const { kit } = useOptions();
  return (
    <kit.Tooltip label="Drag to move">
      <span {...handleProps} className="inline-flex cursor-grab items-center text-current opacity-50 hover:opacity-100" aria-label="Drag to move">
        {kit.icons.grip}
      </span>
    </kit.Tooltip>
  );
}

const dropShadow = (position: 'before' | 'after' | 'inside' | null) =>
  position === 'before' ? 'shadow-[0_-2px_0_currentColor]' : position === 'after' ? 'shadow-[0_2px_0_currentColor]' : '';

const Rule = memo(function Rule({ id }: { id: NodeId }) {
  const { kit, compact, labels, showLock } = useOptions();
  const r = useRule(id);
  const { rule, fields, def, editor, operators, issues, can, source, locked } = r;
  const settings = useSettings();
  const { isDragging, handleProps } = useDragHandle(id);
  const { position, dropProps } = useDropTarget(id);
  const errors = issues.filter((i) => i.severity === 'error');
  const invalid = errors.length > 0;
  const fieldItems = useMemo<Item[]>(() => r.fieldOptions.map((o) => ({ value: o.value, label: o.label, ...(o.group && { group: o.group }) })), [r.fieldOptions]);
  const refItems = useMemo<Item[]>(() => r.refOptions.map((o) => ({ value: o.value, label: o.label })), [r.refOptions]);
  const opItems = useMemo<Item[]>(() => operators.map((o) => ({ value: o.value, label: o.label })), [operators]);
  const lhsFunctions = useMemo(() => (settings.allowFunctions !== false ? functionOptions(fields) : []), [settings.allowFunctions, fields]);
  const sources: Source[] = ['value', ...(r.refOptions.length ? (['field'] as const) : []), ...(r.functionOptions.length ? (['function'] as const) : [])];
  const fieldIsFn = isFnCall(rule.field);
  const errorLine = invalid && <kit.ErrorText>{errors.map((e) => e.message).join(' · ')}</kit.ErrorText>;

  const left = isFnCall(rule.field) ? (
    <FunctionEditor call={rule.field} fields={fields} onChange={r.setField} disabled={!can.editField} />
  ) : (
    <kit.Select items={fieldItems} value={rule.field} placeholder={labels.field} label="Field" disabled={!can.editField} width={compact ? 'full' : 'md'} onChange={(f) => r.setField(f)} />
  );
  const right =
    rule.ref !== undefined ? (
      <kit.Select items={refItems} value={rule.ref} label="Compare with field" disabled={!can.editValue} width="md" onChange={(ref) => r.setRef(ref)} />
    ) : rule.call !== undefined ? (
      <FunctionEditor call={rule.call} fields={fields} kind={def?.kind} onChange={r.setCall} disabled={!can.editValue} />
    ) : (
      <ValueEditor fluid={compact} editor={editor} def={def} value={rule.value} onChange={r.setValue} invalid={invalid} disabled={!can.editValue} placeholder={labels.value} textPlaceholder={labels.valueText} />
    );
  const remove = (
    <kit.Tooltip label="Remove rule">
      <kit.IconButton label="Remove rule" icon={kit.icons.remove} disabled={!can.remove} onClick={r.remove} />
    </kit.Tooltip>
  );

  if (compact) {
    return (
      <div className={`flex flex-col gap-1 ${locked ? 'opacity-70' : ''} ${dropShadow(position)}`} {...dropProps} data-rule={id}>
        <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(8.5rem,0.6fr)_minmax(0,1.1fr)_auto] items-center gap-2">
          {left}
          <kit.Select items={opItems} value={rule.operator} label="Operator" disabled={!can.editOperator} width="full" onChange={r.setOperator} />
          {editor.arity === 'none' ? <span /> : right}
          <div className="flex items-center">
            {showLock && <LockToggle locked={!!rule.locked} disabled={!can.lock} onChange={r.setLocked} what="rule" />}
            {remove}
          </div>
        </div>
        {errorLine}
      </div>
    );
  }

  return (
    <div className={`group/rule flex flex-col gap-1 rounded-lg ${isDragging ? 'opacity-40' : ''} ${locked ? 'opacity-70' : ''} ${dropShadow(position)}`} {...dropProps} data-rule={id}>
      <div className="flex items-start gap-2">
        <span className="mt-2">
          <DragHandle handleProps={handleProps} />
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {lhsFunctions.length > 0 && (
            <kit.Tooltip label={fieldIsFn ? 'Use a field on the left' : 'Use a function on the left, e.g. lowercase(Name)'}>
              <kit.Toggle
                label="Function on the left"
                pressed={fieldIsFn}
                disabled={!can.editField}
                onChange={(on) => r.setField(on ? defaultCall(fields, lhsFunctions[0]!.value) : r.fieldOptions[0]!.value)}
              >
                {kit.icons.fn}
              </kit.Toggle>
            </kit.Tooltip>
          )}
          {left}
          <kit.Select items={opItems} value={rule.operator} label="Operator" disabled={!can.editOperator} width="sm" onChange={r.setOperator} />
          {editor.arity !== 'none' && (
            <SourceSwitch
              value={source}
              available={sources}
              disabled={!can.editValue}
              onChange={(s) => (s === 'field' ? r.setRef(r.refOptions[0]!.value) : s === 'function' ? r.setCall(defaultCall(fields, r.functionOptions[0]!.value)) : r.setRef(null))}
            />
          )}
          {right}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-70 transition-opacity group-hover/rule:opacity-100">
          {showLock && <LockToggle locked={!!rule.locked} disabled={!can.lock} onChange={r.setLocked} what="rule" />}
          <kit.Tooltip label="Duplicate rule">
            <kit.IconButton label="Duplicate rule" icon={kit.icons.copy} disabled={!can.clone} onClick={r.clone} />
          </kit.Tooltip>
          {remove}
        </div>
      </div>
      {errorLine}
    </div>
  );
});

// --- groups -----------------------------------------------------------------------------------------

function NodeView({ id, depth }: { id: NodeId; depth: number }) {
  const kind = useNode(id)?.kind;
  return kind === 'group' ? <Group id={id} depth={depth} /> : <Rule id={id} />;
}

const MATCH_MODES: Item[] = [
  { value: 'some', label: 'some' },
  { value: 'all', label: 'all' },
  { value: 'none', label: 'none' },
  { value: 'count', label: 'count' },
];

/** "[some ▾] of Orders where" / "[at least ▾] [3] of Orders where" for array groups. */
function MatchEditor({ match, label, onChange, disabled }: { match: Quantifier; label: string; onChange: (m: Quantifier) => void; disabled?: boolean }) {
  const { kit, labels } = useOptions();
  const mode = typeof match === 'string' ? match : 'count';
  const counts = useMemo<Item[]>(() => countOptions(labels).map((o) => ({ value: o.value, label: o.label })), [labels]);
  return (
    <span className="inline-flex flex-wrap items-center gap-2" data-match={mode}>
      <kit.Select items={MATCH_MODES} value={mode} label="Match" disabled={disabled} width="xs" onChange={(m) => onChange(m === 'count' ? { count: 'gte', value: 1 } : (m as 'some' | 'all' | 'none'))} />
      {typeof match === 'object' && match.count !== 'between' && (
        <>
          <kit.Select items={counts} value={match.count} label="Count" disabled={disabled} width="sm" onChange={(count) => onChange({ count: count as 'gte', value: match.value })} />
          <kit.NumberInput value={match.value} min={0} label="Count" disabled={disabled} width="xs" onChange={(v) => onChange({ count: match.count, value: v ?? 0 })} />
        </>
      )}
      <kit.Muted>{labels.of}</kit.Muted>
      <kit.Badge>{label}</kit.Badge>
      <kit.Muted>{labels.where}</kit.Muted>
    </span>
  );
}

function AddListCondition({ fields, onAdd, disabled }: { fields: readonly { value: string; label: string }[]; onAdd: (field: string) => void; disabled?: boolean }) {
  const { kit, labels } = useOptions();
  if (!fields.length) return null;
  return (
    <kit.Menu
      trigger={{ label: labels.addArrayGroup, icon: kit.icons.list, tooltip: 'Match rows in a list field: some / all / none / a count of them' }}
      heading="Match items in"
      items={fields}
      disabled={disabled}
      onSelect={onAdd}
    />
  );
}

type Mode = 'all' | 'any' | 'none';
const modeOf = (combinator: string, not: boolean): Mode | null => (not ? (combinator === 'or' ? 'none' : null) : combinator === 'and' ? 'all' : 'any');

/** "If [all | any | none] of these rules are met": all = AND, any = OR, none = NOT (… OR …). */
function SentenceHeader({ id }: { id: NodeId }) {
  const { kit, labels, sentenceIcon } = useOptions();
  const { group, setCombinator, setNot, can } = useGroup(id);
  const store = useStore();
  const pick = (m: Mode) =>
    store.batch(() => {
      setCombinator(m === 'all' ? 'and' : 'or');
      setNot(m === 'none');
    });
  return (
    <div className="flex flex-wrap items-center gap-2.5">
      {sentenceIcon}
      <span className="font-medium text-sm">{labels.sentenceBefore}</span>
      <kit.Segmented
        label="Match"
        value={modeOf(group.combinator, group.not)}
        disabled={!can.editGroup}
        onChange={(m) => pick(m as Mode)}
        items={[
          { value: 'all', label: 'all', tooltip: 'Every rule must match' },
          { value: 'any', label: 'any', tooltip: 'At least one rule must match' },
          { value: 'none', label: 'none', tooltip: 'No rule may match' },
        ]}
      />
      <span className="font-medium text-sm">{labels.sentenceAfter}</span>
    </div>
  );
}

const Group = memo(function Group({ id, depth }: { id: NodeId; depth: number }) {
  const store = useStore();
  const { kit, combinatorStyle, compact, allowGroups, showNot, showLock, labels } = useOptions();
  const g = useGroup(id);
  const { group, isRoot, can, locked } = g;
  const { isDragging, handleProps } = useDragHandle(id);
  const { position, dropProps } = useDropTarget(id);
  const { isOver, zoneProps } = useGroupDropZone(id);
  const sentence = combinatorStyle === 'sentence';
  const arrayLabel = group.of ? fieldLabel(group.of.field, (isRoot ? store.fields : store.fieldsFor(id))[group.of.field]) : '';
  const arrayFields = useMemo(() => g.arrayFields.map((o) => ({ value: o.value, label: o.label })), [g.arrayFields]);

  const children = (
    <div className={`flex flex-col gap-2 ${!isRoot && !sentence ? 'ps-2' : ''} ${isOver ? 'rounded-lg outline-2 outline-current outline-dashed' : ''}`} {...zoneProps}>
      {group.children.length === 0 && !sentence ? <kit.Empty>{labels.empty}</kit.Empty> : group.children.map((c) => <NodeView key={c} id={c} depth={depth + 1} />)}
    </div>
  );
  const addButtons = (
    <>
      <kit.Tooltip label="Add a rule to this group">
        <kit.Button variant={sentence ? 'ghost' : 'outline'} icon={kit.icons.plus} disabled={!can.addRule} onClick={() => g.addRule()}>
          {labels.addRule}
        </kit.Button>
      </kit.Tooltip>
      {allowGroups && (
        <kit.Tooltip label="Add a nested group">
          <kit.Button variant="ghost" icon={kit.icons.folderPlus} disabled={!can.addGroup} onClick={() => g.addGroup()}>
            {labels.addGroup}
          </kit.Button>
        </kit.Tooltip>
      )}
      {allowGroups && <AddListCondition fields={arrayFields} disabled={!can.addGroup} onAdd={(f) => g.addArrayGroup(f)} />}
    </>
  );
  const removeGroup = !isRoot && (
    <kit.Tooltip label="Remove group and its rules">
      <kit.IconButton label="Remove group" icon={kit.icons.remove} disabled={!can.remove} onClick={g.remove} />
    </kit.Tooltip>
  );

  if (sentence) {
    return (
      <kit.Surface kind={isRoot ? 'root' : group.of ? 'array' : 'group'} depth={depth} negated={group.not} locked={locked} drop={position} {...(isRoot ? {} : dropProps)} data-group={id}>
        <div className="flex flex-wrap items-center gap-2">
          {group.of && <MatchEditor match={group.of.match} label={arrayLabel} onChange={g.setMatch} disabled={!can.editGroup} />}
          <SentenceHeader id={id} />
          <div className="ms-auto flex items-center">
            {showLock && <LockToggle locked={!!group.locked} disabled={!can.lock} onChange={g.setLocked} what="group" />}
            {removeGroup}
          </div>
        </div>
        {group.children.length > 0 && children}
        <div className="flex flex-wrap items-center gap-1">{addButtons}</div>
      </kit.Surface>
    );
  }

  return (
    <kit.Surface
      kind={isRoot ? 'root' : group.of ? 'array' : 'group'}
      depth={depth}
      negated={group.not}
      locked={locked}
      dragging={isDragging}
      drop={position}
      style={isRoot ? undefined : { contentVisibility: 'auto', containIntrinsicSize: 'auto 160px' }}
      {...(isRoot ? {} : dropProps)}
      data-group={id}
    >
      <div className="flex flex-wrap items-center gap-2">
        {!isRoot && !compact && <DragHandle handleProps={handleProps} />}
        {group.of && <MatchEditor match={group.of.match} label={arrayLabel} onChange={g.setMatch} disabled={!can.editGroup} />}
        {showNot && (
          <kit.Tooltip label={group.not ? 'Negated: matches when this group does NOT match' : 'Negate this group'}>
            <kit.Toggle label="NOT" pressed={group.not} disabled={!can.editGroup} onChange={g.setNot}>
              NOT
            </kit.Toggle>
          </kit.Tooltip>
        )}
        <kit.Segmented
          label="Combinator"
          value={group.combinator}
          disabled={!can.editGroup}
          onChange={(v) => g.setCombinator(v as 'and' | 'or')}
          items={[
            { value: 'and', label: 'AND', tooltip: 'Match when every rule matches' },
            { value: 'or', label: 'OR', tooltip: 'Match when any rule matches' },
          ]}
        />
        <div className="ms-auto flex flex-wrap items-center gap-1">
          {addButtons}
          {showLock && <LockToggle locked={!!group.locked} disabled={!can.lock} onChange={g.setLocked} what="group" />}
          {!isRoot && !compact && (
            <kit.Tooltip label="Duplicate group">
              <kit.IconButton label="Duplicate group" icon={kit.icons.copy} disabled={!can.clone} onClick={g.clone} />
            </kit.Tooltip>
          )}
          {removeGroup}
        </div>
      </div>
      {children}
    </kit.Surface>
  );
});

export interface QueryBuilderProps extends QueryBuilderOptions {
  store: QueryStore<any, any>;
  className?: string;
}

/** Bind the kit-agnostic builder to a UI kit: returns a `QueryBuilder` component with the coss builder's props. */
export function createQueryBuilder(kit: Kit) {
  function QueryBuilder({ store, className, ...options }: QueryBuilderProps) {
    const { combinatorStyle = 'toggle', compact = false, allowGroups = true, showNot = true, showLock = false, sentenceIcon = null, labels } = options;
    const ctx = useMemo<Ctx>(
      () => ({ kit, combinatorStyle, compact, allowGroups, showNot, showLock, sentenceIcon, labels: { ...DEFAULT_LABELS, ...labels } }),
      // Labels are usually an inline object literal; compare by content.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [combinatorStyle, compact, allowGroups, showNot, showLock, sentenceIcon, JSON.stringify(labels)],
    );
    return (
      <QueryProvider store={store}>
        <OptionsContext.Provider value={ctx}>
          <kit.Provider>
            <div className={className} data-kit={kit.name}>
              <Group id={store.rootId} depth={0} />
            </div>
          </kit.Provider>
        </OptionsContext.Provider>
      </QueryProvider>
    );
  }
  QueryBuilder.displayName = `QueryBuilder(${kit.name})`;
  return QueryBuilder;
}
