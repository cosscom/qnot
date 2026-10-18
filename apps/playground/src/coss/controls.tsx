// coss ui building blocks for trawlnet editors: field/operator selects, a value editor that adapts
// to the field's EditorSpec, value-source switching and a function-call editor. Shared by the query
// builder and the examples.
import {
  editorFor,
  fieldLabel,
  formatList,
  functionOf,
  functionOptions,
  isFnCall,
  parseInput,
  parseList,
  refOptions,
  type AnyFieldDef,
  type EditorSpec,
  type EnumOption,
  type Fields,
  type FnCall,
  type Operand,
} from '@trawlnet/core';
import { LoaderIcon, SquareFunctionIcon, TypeIcon, VariableIcon } from 'lucide-react';
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Tip } from '@/components/tip';
import {
  Combobox,
  ComboboxChip,
  ComboboxChips,
  ComboboxChipsInput,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  ComboboxPopup,
  ComboboxValue,
} from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { Menu, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuTrigger } from '@/components/ui/menu';
import { NumberField, NumberFieldDecrement, NumberFieldGroup, NumberFieldIncrement, NumberFieldInput } from '@/components/ui/number-field';
import { Select, SelectGroup, SelectGroupLabel, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

export interface Item {
  value: string;
  label: string;
  /** Struct label: grouped under a heading in pickers. */
  group?: string;
  /** Tree depth, for indentation. */
  depth?: number;
  disabled?: boolean;
  description?: string;
  /** The typed option value (numbers stay numbers). */
  raw?: unknown;
}

export function CossSelect({
  items,
  value,
  onChange,
  invalid,
  disabled,
  className,
  placeholder,
  size = 'sm',
  mono,
}: {
  items: readonly Item[];
  value: string | null;
  onChange: (v: string) => void;
  invalid?: boolean;
  disabled?: boolean;
  className?: string;
  placeholder?: string;
  size?: 'sm' | 'default';
  mono?: boolean;
}) {
  const sections = useMemo(() => {
    const out = new Map<string | undefined, Item[]>();
    for (const i of items) out.set(i.group, [...(out.get(i.group) ?? []), i]);
    return [...out];
  }, [items]);
  const renderItem = (i: Item) => (
    <SelectItem key={i.value} value={i.value} disabled={i.disabled} style={i.depth ? { paddingInlineStart: `${0.5 + i.depth * 0.9}rem` } : undefined}>
      <span className={cn(i.disabled && 'font-medium text-muted-foreground', mono && 'font-mono text-xs')}>{i.label}</span>
    </SelectItem>
  );
  return (
    <Select items={items as Item[]} value={value} disabled={disabled} onValueChange={(v) => v !== null && onChange(v as string)}>
      <SelectTrigger size={size} className={cn('w-auto min-w-32', mono && 'font-mono text-xs', className)} aria-invalid={invalid || undefined}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectPopup>
        {sections.map(([group, opts]) =>
          group === undefined ? (
            <Fragment key="_">{opts.map(renderItem)}</Fragment>
          ) : (
            <SelectGroup key={group}>
              <SelectGroupLabel>{group}</SelectGroupLabel>
              {opts.map(renderItem)}
            </SelectGroup>
          ),
        )}
      </SelectPopup>
    </Select>
  );
}

export const toItems = (options: EditorSpec['options'] | readonly EnumOption<unknown>[] | undefined): Item[] =>
  (options ?? []).map((o) => ({
    value: String(o.value),
    label: o.label,
    raw: o.value,
    ...('depth' in o && o.depth ? { depth: o.depth as number } : {}),
    ...('disabled' in o && o.disabled ? { disabled: true } : {}),
  }));

/** Free-text list input that keeps "1, 2, " while typing and commits parsed values. */
function ListInput({ def, value, onChange, invalid, disabled, fluid }: { def: AnyFieldDef | undefined; value: unknown; onChange: (v: unknown) => void; invalid: boolean; disabled?: boolean; fluid?: boolean }) {
  const [draft, setDraft] = useState(() => formatList(value));
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    if (formatList(parseList(def, draft)) !== formatList(value)) setDraft(formatList(value));
  }
  return (
    <Input
      size="sm"
      className={fluid ? 'w-full' : 'w-56'}
      placeholder="a, b, c"
      value={draft}
      disabled={disabled}
      aria-invalid={invalid || undefined}
      onChange={(e) => {
        setDraft(e.target.value);
        onChange(parseList(def, e.target.value));
      }}
    />
  );
}

/** Options from the field's async `search`, re-queried (debounced, abortable) as the user types. */
function useAsyncOptions(def: AnyFieldDef | undefined, query: string) {
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
  return { items, loading, labelOf: (v: unknown) => labels.current.get(String(v)) ?? String(v) };
}

/** coss Combobox over an async `search` field: one value, or chips for `in`/`hasAny`. */
function AsyncCombobox({ def, value, onChange, multiple, invalid, disabled, fluid, placeholder }: { def: AnyFieldDef | undefined; value: unknown; onChange: (v: unknown) => void; multiple?: boolean; invalid: boolean; disabled?: boolean; fluid?: boolean; placeholder?: string }) {
  const [query, setQuery] = useState('');
  const { items, loading, labelOf } = useAsyncOptions(def, query);
  const eq = (a: Item, b: Item) => a.value === b.value;
  const status = loading ? (
    <div className="flex items-center gap-2 px-2 py-1.5 text-muted-foreground text-sm">
      <LoaderIcon className="size-3.5 animate-spin" /> Searching…
    </div>
  ) : (
    <ComboboxEmpty>No matches.</ComboboxEmpty>
  );
  const list = (
    <ComboboxPopup>
      {status}
      <ComboboxList>
        {(i: Item) => (
          <ComboboxItem key={i.value} value={i}>
            {i.label}
          </ComboboxItem>
        )}
      </ComboboxList>
    </ComboboxPopup>
  );
  if (multiple) {
    const selected: Item[] = Array.isArray(value) ? value.map((v) => ({ value: String(v), label: labelOf(v), raw: v })) : [];
    return (
      <div className={fluid ? 'w-full min-w-0' : 'min-w-56 max-w-md flex-1'}>
        <Combobox items={items} filter={null} multiple value={selected} disabled={disabled} isItemEqualToValue={eq} onInputValueChange={setQuery} onValueChange={(next: Item[]) => onChange(next.map((i) => i.raw ?? i.value))}>
          <ComboboxChips aria-invalid={invalid || undefined}>
            <ComboboxValue>
              {(chosen: Item[]) => (
                <>
                  {chosen.map((i) => (
                    <ComboboxChip key={i.value} aria-label={i.label}>
                      {i.label}
                    </ComboboxChip>
                  ))}
                  <ComboboxChipsInput size="sm" placeholder={chosen.length ? undefined : (placeholder ?? 'Search…')} />
                </>
              )}
            </ComboboxValue>
          </ComboboxChips>
          {list}
        </Combobox>
      </div>
    );
  }
  const selected: Item | null = value === null || value === undefined || value === '' ? null : { value: String(value), label: labelOf(value), raw: value };
  return (
    <div className={fluid ? 'w-full min-w-0' : 'w-56'}>
      <Combobox
        items={items}
        filter={null}
        value={selected}
        disabled={disabled}
        isItemEqualToValue={eq}
        onInputValueChange={setQuery}
        onValueChange={(next: Item | null) => onChange(next ? (next.raw ?? next.value) : def?.allowCustom && query ? query : null)}
      >
        <ComboboxInput size="sm" placeholder={placeholder ?? 'Search…'} aria-invalid={invalid || undefined} />
        {list}
      </Combobox>
    </div>
  );
}

function Affixed({ def, children }: { def: AnyFieldDef | undefined; children: ReactNode }) {
  if (!def?.prefix && !def?.suffix) return <>{children}</>;
  return (
    <span className="inline-flex items-center gap-1.5">
      {def.prefix && <span className="text-muted-foreground text-sm">{def.prefix}</span>}
      {children}
      {def.suffix && <span className="text-muted-foreground text-sm">{def.suffix}</span>}
    </span>
  );
}

export interface ValueEditorProps {
  editor: EditorSpec;
  def: AnyFieldDef | undefined;
  value: unknown;
  onChange: (v: unknown) => void;
  invalid: boolean;
  disabled?: boolean;
  /** Stretch inputs to fill the row instead of using fixed widths. */
  fluid?: boolean;
  /** Placeholder for pickers (selects, multi-selects). */
  placeholder?: string;
  /** Placeholder for free-text inputs. */
  textPlaceholder?: string;
}

function ScalarEditor({ editor, def, value, onChange, invalid, disabled, fluid, placeholder, textPlaceholder }: ValueEditorProps) {
  const aria = { 'aria-invalid': invalid || undefined, disabled };
  if (editor.async) return <AsyncCombobox def={def} value={value} onChange={onChange} invalid={invalid} disabled={disabled} fluid={fluid} />;
  switch (editor.type) {
    case 'boolean':
      return (
        <label className="inline-flex h-8 items-center gap-2 text-sm">
          <Switch checked={value === true} disabled={disabled} onCheckedChange={(c) => onChange(c)} />
          {value === true ? 'true' : 'false'}
        </label>
      );
    case 'select': {
      const items = toItems(editor.options);
      return (
        <CossSelect
          items={items}
          value={value === null || value === undefined ? null : String(value)}
          onChange={(v) => onChange(items.find((i) => i.value === v)?.raw ?? parseInput(def, v))}
          invalid={invalid}
          disabled={disabled}
          placeholder={placeholder ?? 'Choose…'}
          className={fluid ? 'w-full' : undefined}
        />
      );
    }
    case 'number':
      return (
        <Affixed def={def}>
          <NumberField size="sm" className={fluid ? 'w-full' : 'w-32'} value={typeof value === 'number' ? value : null} min={def?.min} max={def?.max} step={def?.step} disabled={disabled} onValueChange={(v) => onChange(v)}>
            <NumberFieldGroup>
              <NumberFieldDecrement />
              <NumberFieldInput aria-invalid={invalid || undefined} placeholder={def?.placeholder} />
              <NumberFieldIncrement />
            </NumberFieldGroup>
          </NumberField>
        </Affixed>
      );
    case 'slider': {
      const min = def?.min ?? 0;
      const max = def?.max ?? 100;
      const v = typeof value === 'number' ? value : min;
      return (
        <Affixed def={def}>
          <span className={cn('inline-flex items-center gap-3', fluid ? 'w-full' : 'w-56')}>
            <Slider className="flex-1" value={v} min={min} max={max} step={def?.step ?? 1} disabled={disabled} aria-label={def?.label ?? 'Value'} onValueChange={(n) => onChange(Array.isArray(n) ? n[0] : n)} />
            <span className="w-8 text-end font-medium text-sm tabular-nums">{typeof value === 'number' ? value : '–'}</span>
          </span>
        </Affixed>
      );
    }
    case 'date':
    case 'time':
      return <Input size="sm" type={editor.type} className={fluid ? 'w-full' : editor.type === 'time' ? 'w-32' : 'w-40'} value={typeof value === 'string' ? value : ''} {...aria} onChange={(e) => onChange(e.target.value || null)} />;
    case 'datetime':
      return <Input size="sm" type="datetime-local" className={fluid ? 'w-full' : 'w-52'} value={typeof value === 'string' ? value.slice(0, 16) : ''} {...aria} onChange={(e) => onChange(e.target.value || null)} />;
    case 'textarea':
      return <Textarea className={fluid ? 'w-full' : 'w-64'} rows={2} placeholder={def?.placeholder ?? textPlaceholder} value={typeof value === 'string' ? value : ''} {...aria} onChange={(e) => onChange(e.target.value)} />;
    default:
      return (
        <Affixed def={def}>
          <Input size="sm" className={fluid ? 'w-full' : 'w-48'} placeholder={def?.placeholder ?? textPlaceholder} value={typeof value === 'string' ? value : ''} {...aria} onChange={(e) => onChange(e.target.value)} />
        </Affixed>
      );
  }
}

export function ValueEditor(props: ValueEditorProps) {
  const { editor, def, value, onChange, invalid, disabled } = props;
  if (editor.arity === 'none') return null;
  if (editor.arity === 'two') {
    const pair = Array.isArray(value) ? value : [null, null];
    return (
      <span className={cn('inline-flex items-center gap-2', props.fluid && 'w-full')}>
        <ScalarEditor {...props} value={pair[0]} onChange={(v) => onChange([v, pair[1]])} />
        <span className="text-muted-foreground text-sm">and</span>
        <ScalarEditor {...props} value={pair[1]} onChange={(v) => onChange([pair[0], v])} />
      </span>
    );
  }
  if (editor.arity === 'many') {
    if (editor.async) return <AsyncCombobox def={def} value={value} onChange={onChange} multiple invalid={invalid} disabled={disabled} fluid={props.fluid} />;
    if (editor.type !== 'multiselect') return <ListInput def={def} value={value} onChange={onChange} invalid={invalid} disabled={disabled} fluid={props.fluid} />;
    const items = toItems(editor.options);
    const selected = Array.isArray(value) ? items.filter((i) => value.some((v) => String(v) === i.value)) : [];
    return (
      <div className={props.fluid ? 'w-full min-w-0' : 'min-w-56 max-w-md flex-1'}>
        <Combobox items={items} multiple value={selected} disabled={disabled} onValueChange={(next: Item[]) => onChange(next.map((i) => i.raw ?? parseInput(def, i.value)))}>
          <ComboboxChips aria-invalid={invalid || undefined}>
            <ComboboxValue>
              {(chosen: Item[]) => (
                <>
                  {chosen.map((i) => (
                    <ComboboxChip key={i.value} aria-label={i.label}>
                      {i.label}
                    </ComboboxChip>
                  ))}
                  <ComboboxChipsInput size="sm" placeholder={chosen.length ? undefined : (props.placeholder ?? 'Choose…')} />
                </>
              )}
            </ComboboxValue>
          </ComboboxChips>
          <ComboboxPopup>
            <ComboboxEmpty>No matches.</ComboboxEmpty>
            <ComboboxList>
              {(i: Item) => (
                <ComboboxItem key={i.value} value={i} disabled={i.disabled} style={i.depth ? { paddingInlineStart: `${0.5 + i.depth * 0.9}rem` } : undefined}>
                  <span className={cn(i.disabled && 'font-medium text-muted-foreground')}>{i.label}</span>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxPopup>
        </Combobox>
      </div>
    );
  }
  return <ScalarEditor {...props} />;
}

// --- value sources and functions ------------------------------------------------------------------

export type Source = 'value' | 'field' | 'function';

const SOURCE_META = {
  value: { icon: TypeIcon, label: 'Compare with a value' },
  field: { icon: VariableIcon, label: 'Compare with another field' },
  function: { icon: SquareFunctionIcon, label: 'Compare with a function' },
} as const;

/** Value / Field / Function segmented switch for a rule's right-hand side. */
export function SourceSwitch({ value, available, onChange, disabled }: { value: Source; available: readonly Source[]; onChange: (s: Source) => void; disabled?: boolean }) {
  if (available.length < 2) return null;
  return (
    <ToggleGroup size="sm" className="rounded-lg bg-muted/70 p-0.5 dark:bg-muted/40" value={[value]} disabled={disabled} onValueChange={(v) => v[0] && onChange(v[0] as Source)} aria-label="Compare with">
      {available.map((s) => {
        const { icon: Icon, label } = SOURCE_META[s];
        return (
          <Tip key={s} label={label}>
            <ToggleGroupItem value={s} aria-label={label} data-source={s} className="h-6 rounded-md px-1.5 text-muted-foreground data-pressed:bg-background data-pressed:text-foreground data-pressed:shadow-xs/5">
              <Icon />
            </ToggleGroupItem>
          </Tip>
        );
      })}
    </ToggleGroup>
  );
}

/** A call to `fn` with every argument at its default. */
export const defaultCall = (fields: Fields, fn: string): FnCall => {
  const def = functionOf(fields, { fn, args: {} });
  return { fn, args: Object.fromEntries(Object.entries(def?.args ?? {}).map(([name, a]) => [name, { value: a.defaultValue ?? null }])) };
};

/** Editor for a function call, rendered like `lowercase( [Name ▾] )`; arguments nest. */
export function FunctionEditor({ call, fields, kind, onChange, disabled }: { call: FnCall; fields: Fields; kind?: string; onChange: (c: FnCall) => void; disabled?: boolean }) {
  const fns = useMemo(() => functionOptions(fields, kind).map((o) => ({ value: o.value, label: o.label })), [fields, kind]);
  const def = functionOf(fields, call);
  const args = Object.entries(def?.args ?? {});
  return (
    <span className="inline-flex flex-wrap items-center gap-1 rounded-lg border border-dashed bg-muted/40 py-0.5 ps-0.5 pe-2 dark:bg-muted/20" data-function={call.fn}>
      <CossSelect mono className="min-w-24 border-0 bg-transparent shadow-none" items={fns} value={call.fn} disabled={disabled} onChange={(fn) => onChange(defaultCall(fields, fn))} />
      <span className="font-mono text-muted-foreground text-sm">(</span>
      {args.map(([name, argDef], i) => (
        <span key={name} className="inline-flex items-center gap-1">
          {i > 0 && <span className="font-mono text-muted-foreground">,</span>}
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
      <span className="font-mono text-muted-foreground text-sm">)</span>
    </span>
  );
}

/** One function argument: a literal, another field, or a nested call, with a tiny source menu. */
function OperandEditor({ operand, def, fields, label, onChange, disabled }: { operand: Operand; def: AnyFieldDef; fields: Fields; label: string; onChange: (o: Operand) => void; disabled?: boolean }) {
  const refs = useMemo(() => refOptions(fields, '', def.kind).map((o) => ({ value: o.value, label: o.label })), [fields, def.kind]);
  const nested = useMemo(() => functionOptions(fields, def.kind), [fields, def.kind]);
  const source: Source = isFnCall(operand) ? 'function' : 'ref' in operand ? 'field' : 'value';
  const available: Source[] = ['value', ...(refs.length ? (['field'] as const) : []), ...(nested.length ? (['function'] as const) : [])];
  const Icon = SOURCE_META[source].icon;
  return (
    <span className="inline-flex items-center gap-1">
      {available.length > 1 && (
        <Menu>
          <Tip label={`${label}: ${source}`}>
            <MenuTrigger disabled={disabled} className="flex size-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground" aria-label={`${label} source`}>
              <Icon className="size-3.5" />
            </MenuTrigger>
          </Tip>
          <MenuPopup align="start">
            <MenuRadioGroup
              value={source}
              onValueChange={(s) =>
                onChange(s === 'field' ? { ref: refs[0]!.value } : s === 'function' ? defaultCall(fields, nested[0]!.value) : { value: def.defaultValue ?? null })
              }
            >
              {available.map((s) => (
                <MenuRadioItem key={s} value={s}>
                  {s === 'value' ? `${label} (value)` : s === 'field' ? 'Another field' : 'A function'}
                </MenuRadioItem>
              ))}
            </MenuRadioGroup>
          </MenuPopup>
        </Menu>
      )}
      {isFnCall(operand) ? (
        <FunctionEditor call={operand} fields={fields} kind={def.kind} onChange={onChange} disabled={disabled} />
      ) : 'ref' in operand ? (
        <CossSelect items={refs} value={operand.ref} disabled={disabled} onChange={(ref) => onChange({ ref })} />
      ) : (
        <ScalarEditor editor={editorFor(def, 'eq', fields)} def={def} value={operand.value} invalid={false} disabled={disabled} placeholder={label} textPlaceholder={label} onChange={(value) => onChange({ value })} />
      )}
    </span>
  );
}

