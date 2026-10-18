// A trawlnet query builder made entirely of coss ui components, on top of @trawlnet/react's
// headless hooks. Nothing here touches the store directly except through those hooks, so this file
// doubles as the "bring your own UI kit" recipe.
import {
  fieldOptions,
  formatList,
  parseInput,
  parseList,
  refOptions,
  type AnyFieldDef,
  type EditorSpec,
  type EnumOption,
  type NodeId,
  type QueryStore,
} from '@trawlnet/core';
import { QueryProvider, useDragHandle, useDropTarget, useGroup, useGroupDropZone, useNode, useRule, useStore } from '@trawlnet/react';
import { CopyIcon, FolderPlusIcon, GripVerticalIcon, PlusIcon, VariableIcon, PencilLineIcon, XIcon } from 'lucide-react';
import { memo, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Combobox, ComboboxChip, ComboboxChips, ComboboxChipsInput, ComboboxEmpty, ComboboxItem, ComboboxList, ComboboxPopup, ComboboxValue } from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import { NumberField, NumberFieldDecrement, NumberFieldGroup, NumberFieldIncrement, NumberFieldInput } from '@/components/ui/number-field';
import { Select, SelectItem, SelectPopup, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';

interface Item {
  value: string;
  label: string;
}

function CossSelect({ items, value, onChange, invalid, className, placeholder }: { items: Item[]; value: string | null; onChange: (v: string) => void; invalid?: boolean; className?: string; placeholder?: string }) {
  return (
    <Select items={items} value={value} onValueChange={(v) => v !== null && onChange(v as string)}>
      <SelectTrigger size="sm" className={cn('w-auto min-w-32', className)} aria-invalid={invalid || undefined}>
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

const toItems = (options: readonly EnumOption<unknown>[] | undefined): Item[] => (options ?? []).map((o) => ({ value: String(o.value), label: o.label }));

/** Free-text list input that keeps "1, 2, " while typing and commits parsed values. */
function ListInput({ def, value, onChange, invalid }: { def: AnyFieldDef | undefined; value: unknown; onChange: (v: unknown) => void; invalid: boolean }) {
  const [draft, setDraft] = useState(() => formatList(value));
  const [prev, setPrev] = useState(value);
  if (prev !== value) {
    setPrev(value);
    if (formatList(parseList(def, draft)) !== formatList(value)) setDraft(formatList(value));
  }
  return (
    <Input
      size="sm"
      className="w-56"
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

function ScalarEditor({ editor, def, value, onChange, invalid }: { editor: EditorSpec; def: AnyFieldDef | undefined; value: unknown; onChange: (v: unknown) => void; invalid: boolean }) {
  switch (editor.type) {
    case 'boolean':
      return (
        <label className="inline-flex h-8 items-center gap-2 text-sm">
          <Switch checked={value === true} onCheckedChange={(c) => onChange(c)} />
          {value === true ? 'true' : 'false'}
        </label>
      );
    case 'select':
      return <CossSelect items={toItems(editor.options)} value={value === null || value === undefined ? null : String(value)} onChange={(v) => onChange(parseInput(def, v))} invalid={invalid} placeholder="Choose…" />;
    case 'number':
      return (
        <NumberField size="sm" className="w-32" value={typeof value === 'number' ? value : null} onValueChange={(v) => onChange(v)}>
          <NumberFieldGroup>
            <NumberFieldDecrement />
            <NumberFieldInput aria-invalid={invalid || undefined} />
            <NumberFieldIncrement />
          </NumberFieldGroup>
        </NumberField>
      );
    case 'date':
      return <Input size="sm" type="date" className="w-40" value={typeof value === 'string' ? value : ''} aria-invalid={invalid || undefined} onChange={(e) => onChange(e.target.value || null)} />;
    default:
      return <Input size="sm" className="w-48" value={typeof value === 'string' ? value : ''} aria-invalid={invalid || undefined} onChange={(e) => onChange(e.target.value)} />;
  }
}

function ValueEditor(props: { editor: EditorSpec; def: AnyFieldDef | undefined; value: unknown; onChange: (v: unknown) => void; invalid: boolean }) {
  const { editor, def, value, onChange, invalid } = props;
  if (editor.arity === 'none') return null;
  if (editor.arity === 'two') {
    const pair = Array.isArray(value) ? value : [null, null];
    return (
      <span className="inline-flex items-center gap-2">
        <ScalarEditor {...props} value={pair[0]} onChange={(v) => onChange([v, pair[1]])} />
        <span className="text-muted-foreground text-sm">and</span>
        <ScalarEditor {...props} value={pair[1]} onChange={(v) => onChange([pair[0], v])} />
      </span>
    );
  }
  if (editor.arity === 'many') {
    if (editor.type !== 'multiselect') return <ListInput def={def} value={value} onChange={onChange} invalid={invalid} />;
    const items = toItems(editor.options);
    const selected = Array.isArray(value) ? items.filter((i) => value.some((v) => String(v) === i.value)) : [];
    return (
      <div className="min-w-56 max-w-md flex-1">
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
                <ComboboxChipsInput size="sm" placeholder={chosen.length ? undefined : 'Choose…'} />
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

const dropLine = (position: 'before' | 'after' | 'inside' | null) =>
  position === 'before' ? 'shadow-[0_-2px_0_var(--color-primary)]' : position === 'after' ? 'shadow-[0_2px_0_var(--color-primary)]' : '';

const Rule = memo(function Rule({ id, fields }: { id: NodeId; fields: Item[] }) {
  const store = useStore();
  const { rule, def, editor, operators, issues, setField, setOperator, setValue, setRef, remove, clone } = useRule(id);
  const { isDragging, handleProps } = useDragHandle(id);
  const { position, dropProps } = useDropTarget(id);
  const refs = useMemo(() => (editor.allowsRef ? refOptions(store.fields, rule.field) : []), [store, editor.allowsRef, rule.field]);
  const errors = issues.filter((i) => i.severity === 'error');
  const invalid = errors.length > 0;

  return (
    <div className={cn('group/rule flex flex-col gap-1 rounded-lg', isDragging && 'opacity-40', dropLine(position))} {...dropProps}>
      <div className="flex flex-wrap items-center gap-2">
        <span {...handleProps} className="cursor-grab text-muted-foreground/60 hover:text-foreground" title="Drag to move">
          <GripVerticalIcon className="size-4" />
        </span>
        <CossSelect items={fields} value={rule.field} onChange={(f) => setField(f)} />
        <CossSelect items={operators} value={rule.operator} onChange={(op) => setOperator(op as typeof rule.operator)} />
        {rule.ref !== undefined ? (
          <CossSelect items={refs} value={rule.ref} onChange={(r) => setRef(r)} />
        ) : (
          <ValueEditor editor={editor} def={def} value={rule.value} onChange={setValue} invalid={invalid} />
        )}
        <div className="ms-auto flex items-center gap-0.5 opacity-60 transition-opacity group-hover/rule:opacity-100">
          {refs.length > 0 && (
            <Button size="icon-sm" variant="ghost" title={rule.ref === undefined ? 'Compare with another field' : 'Compare with a value'} onClick={() => setRef(rule.ref === undefined ? refs[0]!.value : null)}>
              {rule.ref === undefined ? <VariableIcon /> : <PencilLineIcon />}
            </Button>
          )}
          <Button size="icon-sm" variant="ghost" title="Duplicate" onClick={clone}>
            <CopyIcon />
          </Button>
          <Button size="icon-sm" variant="ghost" title="Remove" onClick={remove}>
            <XIcon />
          </Button>
        </div>
      </div>
      {invalid && <p className="ps-6 text-destructive-foreground text-xs">{errors.map((e) => e.message).join(' · ')}</p>}
    </div>
  );
});

function NodeView({ id, fields, depth }: { id: NodeId; fields: Item[]; depth: number }) {
  const kind = useNode(id)?.kind;
  return kind === 'group' ? <Group id={id} fields={fields} depth={depth} /> : <Rule id={id} fields={fields} />;
}

const Group = memo(function Group({ id, fields, depth }: { id: NodeId; fields: Item[]; depth: number }) {
  const { group, isRoot, setCombinator, setNot, addRule, addGroup, remove, clone } = useGroup(id);
  const { isDragging, handleProps } = useDragHandle(id);
  const { position, dropProps } = useDropTarget(id);
  const { isOver, zoneProps } = useGroupDropZone(id);

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-3',
        depth % 2 === 0 ? 'bg-muted/40' : 'bg-background',
        group.not && 'border-dashed border-warning/60',
        isDragging && 'opacity-40',
        dropLine(position),
      )}
      style={isRoot ? undefined : { contentVisibility: 'auto', containIntrinsicSize: 'auto 160px' }}
      {...(isRoot ? {} : dropProps)}
    >
      <div className="flex flex-wrap items-center gap-2">
        {!isRoot && (
          <span {...handleProps} className="cursor-grab text-muted-foreground/60 hover:text-foreground" title="Drag to move">
            <GripVerticalIcon className="size-4" />
          </span>
        )}
        <Toggle size="sm" variant="outline" pressed={group.not} onPressedChange={setNot} title="Negate this group">
          NOT
        </Toggle>
        <ToggleGroup size="sm" variant="outline" value={[group.combinator]} onValueChange={(v) => v[0] && setCombinator(v[0] as 'and' | 'or')}>
          <ToggleGroupItem value="and">AND</ToggleGroupItem>
          <ToggleGroupItem value="or">OR</ToggleGroupItem>
        </ToggleGroup>
        <div className="ms-auto flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={() => addRule()}>
            <PlusIcon /> Rule
          </Button>
          <Button size="sm" variant="ghost" onClick={() => addGroup()}>
            <FolderPlusIcon /> Group
          </Button>
          {!isRoot && (
            <>
              <Button size="icon-sm" variant="ghost" title="Duplicate group" onClick={clone}>
                <CopyIcon />
              </Button>
              <Button size="icon-sm" variant="ghost" title="Remove group" onClick={remove}>
                <XIcon />
              </Button>
            </>
          )}
        </div>
      </div>
      <div className={cn('flex flex-col gap-2', !isRoot && 'ps-2', isOver && 'rounded-lg outline-2 outline-dashed outline-primary')} {...zoneProps}>
        {group.children.length === 0 ? (
          <p className="rounded-lg border border-dashed px-3 py-4 text-center text-muted-foreground text-sm">Empty group: add a rule or drag one here.</p>
        ) : (
          group.children.map((c) => <NodeView key={c} id={c} fields={fields} depth={depth + 1} />)
        )}
      </div>
    </div>
  );
});

export function CossQueryBuilder({ store }: { store: QueryStore<any, any> }) {
  const fields = useMemo(() => fieldOptions(store.fields), [store]);
  return (
    <QueryProvider store={store}>
      <Group id={store.rootId} fields={fields} depth={0} />
    </QueryProvider>
  );
}
