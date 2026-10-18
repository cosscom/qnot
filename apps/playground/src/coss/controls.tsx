// coss ui building blocks for trawlnet editors: field/operator selects and a value editor that
// adapts to the field's EditorSpec. Shared by the query builder and the examples.
import { formatList, parseInput, parseList, type AnyFieldDef, type EditorSpec, type EnumOption } from '@trawlnet/core';
import { useState } from 'react';
import { Combobox, ComboboxChip, ComboboxChips, ComboboxChipsInput, ComboboxEmpty, ComboboxItem, ComboboxList, ComboboxPopup, ComboboxValue } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { NumberField, NumberFieldDecrement, NumberFieldGroup, NumberFieldIncrement, NumberFieldInput } from '@/components/ui/number-field';
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export interface Item {
  value: string;
  label: string;
}

export function CossSelect({ items, value, onChange, invalid, className, placeholder, size = 'sm' }: { items: readonly Item[]; value: string | null; onChange: (v: string) => void; invalid?: boolean; className?: string; placeholder?: string; size?: 'sm' | 'default' }) {
  return (
    <Select items={items} value={value} onValueChange={(v) => v !== null && onChange(v as string)}>
      <SelectTrigger size={size} className={cn('w-auto min-w-32', className)} aria-invalid={invalid || undefined}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectPopup>
        {items.map((i) => (
          <SelectItem key={i.value} value={i.value}>
            {i.label}
          </SelectItem>
        ))}
      </SelectPopup>
    </Select>
  );
}

export const toItems = (options: readonly EnumOption<unknown>[] | undefined): Item[] => (options ?? []).map((o) => ({ value: String(o.value), label: o.label }));

/** Free-text list input that keeps "1, 2, " while typing and commits parsed values. */
function ListInput({ def, value, onChange, invalid, fluid }: { def: AnyFieldDef | undefined; value: unknown; onChange: (v: unknown) => void; invalid: boolean; fluid?: boolean }) {
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
      aria-invalid={invalid || undefined}
      onChange={(e) => {
        setDraft(e.target.value);
        onChange(parseList(def, e.target.value));
      }}
    />
  );
}

function ScalarEditor({ editor, def, value, onChange, invalid, fluid, placeholder, textPlaceholder }: ValueEditorProps) {
  switch (editor.type) {
    case 'boolean':
      return (
        <label className="inline-flex h-8 items-center gap-2 text-sm">
          <Switch checked={value === true} onCheckedChange={(c) => onChange(c)} />
          {value === true ? 'true' : 'false'}
        </label>
      );
    case 'select':
      return <CossSelect items={toItems(editor.options)} value={value === null || value === undefined ? null : String(value)} onChange={(v) => onChange(parseInput(def, v))} invalid={invalid} placeholder={placeholder ?? 'Choose…'} className={fluid ? 'w-full' : undefined} />;
    case 'number':
      return (
        <NumberField size="sm" className={fluid ? 'w-full' : 'w-32'} value={typeof value === 'number' ? value : null} onValueChange={(v) => onChange(v)}>
          <NumberFieldGroup>
            <NumberFieldDecrement />
            <NumberFieldInput aria-invalid={invalid || undefined} />
            <NumberFieldIncrement />
          </NumberFieldGroup>
        </NumberField>
      );
    case 'date':
      return <Input size="sm" type="date" className={fluid ? 'w-full' : 'w-40'} value={typeof value === 'string' ? value : ''} aria-invalid={invalid || undefined} onChange={(e) => onChange(e.target.value || null)} />;
    default:
      return <Input size="sm" className={fluid ? 'w-full' : 'w-48'} placeholder={textPlaceholder} value={typeof value === 'string' ? value : ''} aria-invalid={invalid || undefined} onChange={(e) => onChange(e.target.value)} />;
  }
}

export interface ValueEditorProps {
  editor: EditorSpec;
  def: AnyFieldDef | undefined;
  value: unknown;
  onChange: (v: unknown) => void;
  invalid: boolean;
  /** Stretch inputs to fill the row instead of using fixed widths. */
  fluid?: boolean;
  /** Placeholder for pickers (selects, multi-selects). */
  placeholder?: string;
  /** Placeholder for free-text inputs. */
  textPlaceholder?: string;
}

export function ValueEditor(props: ValueEditorProps) {
  const { editor, def, value, onChange, invalid } = props;
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
    if (editor.type !== 'multiselect') return <ListInput def={def} value={value} onChange={onChange} invalid={invalid} fluid={props.fluid} />;
    const items = toItems(editor.options);
    const selected = Array.isArray(value) ? items.filter((i) => value.some((v) => String(v) === i.value)) : [];
    return (
      <div className={props.fluid ? 'w-full min-w-0' : 'min-w-56 max-w-md flex-1'}>
      <Combobox items={items} multiple value={selected} onValueChange={(next: Item[]) => onChange(next.map((i) => parseInput(def, i.value)))}>
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
              <ComboboxItem key={i.value} value={i}>
                {i.label}
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

