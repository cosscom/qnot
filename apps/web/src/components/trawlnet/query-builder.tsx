// Part of trawlnet (https://github.com/sean-brydon/trawlnet). MIT licensed; installable with shadcn.
'use client';

// A trawlnet query builder made entirely of coss ui components, on top of @trawlnet/react's
// headless hooks. Nothing here touches the store directly except through those hooks, so this file
// doubles as the "bring your own UI kit" recipe. Feature-for-feature it matches @trawlnet/react's
// default UI (RAQB parity): grouped struct fields, value sources, functions on either side, array
// groups, locks and permission-driven disabling.
import { fieldLabel, functionOptions, isFnCall, type NodeId, type Quantifier, type QueryStore } from '@trawlnet/core';
import { QueryProvider, useDragHandle, useDropTarget, useGroup, useGroupDropZone, useNode, useRule, useSettings, useStore } from '@trawlnet/react';
import { CopyIcon, FolderPlusIcon, GripVerticalIcon, ListTreeIcon, LockIcon, LockOpenIcon, PlusIcon, SquareFunctionIcon, XIcon } from 'lucide-react';
import { createContext, memo, useContext, useMemo, type ReactNode } from 'react';
import { Tip } from '@/components/trawlnet/tip';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Menu, MenuGroup, MenuGroupLabel, MenuItem, MenuPopup, MenuTrigger } from '@/components/ui/menu';
import { NumberField, NumberFieldGroup, NumberFieldInput } from '@/components/ui/number-field';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { CossSelect, FunctionEditor, SourceSwitch, ValueEditor, defaultCall, type Item, type Source } from '@/components/trawlnet/controls';

export interface CossQueryBuilderOptions {
  /** `toggle`: NOT + AND/OR buttons. `sentence`: "If [all | any | none] of these rules are met". */
  combinatorStyle?: 'toggle' | 'sentence';
  /** Full-width rule rows with only field, operator, value and remove (no drag, duplicate or sources). */
  compact?: boolean;
  /** Offer "+ Group" (nested groups). Default true. */
  allowGroups?: boolean;
  /** Show the NOT toggle on groups (default true). RAQB showNot. */
  showNot?: boolean;
  /** Show lock toggles on rules and groups (default false). RAQB showLock. */
  showLock?: boolean;
  /** Icon shown before the sentence header. */
  sentenceIcon?: ReactNode;
  labels?: Partial<Labels>;
}

const DEFAULT_LABELS = {
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
};
type Labels = typeof DEFAULT_LABELS;

interface Ctx extends Required<Omit<CossQueryBuilderOptions, 'sentenceIcon' | 'labels'>> {
  labels: Labels;
  sentenceIcon: ReactNode;
}
const OptionsContext = createContext<Ctx>(null!);
const useOptions = () => useContext(OptionsContext);

const dropLine = (position: 'before' | 'after' | 'inside' | null) =>
  position === 'before' ? 'shadow-[0_-2px_0_var(--color-primary)]' : position === 'after' ? 'shadow-[0_2px_0_var(--color-primary)]' : '';

function LockToggle({ locked, disabled, onChange, what }: { locked: boolean; disabled: boolean; onChange: (l: boolean) => void; what: string }) {
  const { labels } = useOptions();
  return (
    <Tip label={locked ? `${labels.unlock} ${what}` : `${labels.lock} ${what}: no edits, moves or removal`}>
      <Button size="icon-sm" variant="ghost" aria-label={locked ? labels.unlock : labels.lock} aria-pressed={locked} data-lock={locked} disabled={disabled} onClick={() => onChange(!locked)}>
        {locked ? <LockIcon className="text-warning-foreground" /> : <LockOpenIcon />}
      </Button>
    </Tip>
  );
}

const Rule = memo(function Rule({ id }: { id: NodeId }) {
  const { compact, labels, showLock } = useOptions();
  const r = useRule(id);
  const { rule, fields, def, editor, operators, issues, can, source, locked } = r;
  // Re-read value-source settings: useRule memoizes its option lists per field, not per settings.
  const settings = useSettings();
  const refOptions = settings.allowRefs === false ? [] : r.refOptions;
  const fnOptions = settings.allowFunctions === false ? [] : r.functionOptions;
  const { isDragging, handleProps } = useDragHandle(id);
  const { position, dropProps } = useDropTarget(id);
  const errors = issues.filter((i) => i.severity === 'error');
  const invalid = errors.length > 0;
  const fieldItems = useMemo<Item[]>(() => r.fieldOptions.map((o) => ({ value: o.value, label: o.label, ...(o.group && { group: o.group }) })), [r.fieldOptions]);
  const refItems = useMemo<Item[]>(() => refOptions.map((o) => ({ value: o.value, label: o.label })), [refOptions]);
  const lhsFunctions = useMemo(() => (settings.allowFunctions !== false ? functionOptions(fields) : []), [settings.allowFunctions, fields]);
  const sources: Source[] = ['value', ...(refOptions.length ? (['field'] as const) : []), ...(fnOptions.length ? (['function'] as const) : [])];
  const fieldIsFn = isFnCall(rule.field);
  const errorLine = invalid && <p className={cn('text-destructive-foreground text-xs', !compact && 'ps-6')}>{errors.map((e) => e.message).join(' · ')}</p>;

  const left = isFnCall(rule.field) ? (
    <FunctionEditor call={rule.field} fields={fields} onChange={r.setField} disabled={!can.editField} />
  ) : (
    <CossSelect className={compact ? 'w-full' : undefined} items={fieldItems} value={rule.field} placeholder={labels.field} disabled={!can.editField} onChange={(f) => r.setField(f)} />
  );
  const right =
    rule.ref !== undefined ? (
      <CossSelect items={refItems} value={rule.ref} disabled={!can.editValue} onChange={(ref) => r.setRef(ref)} />
    ) : rule.call !== undefined ? (
      <FunctionEditor call={rule.call} fields={fields} kind={def?.kind} onChange={r.setCall} disabled={!can.editValue} />
    ) : (
      <ValueEditor fluid={compact} editor={editor} def={def} value={rule.value} onChange={r.setValue} invalid={invalid} disabled={!can.editValue} placeholder={labels.value} textPlaceholder={labels.valueText} />
    );

  if (compact) {
    return (
      <div className={cn('flex flex-col gap-1', locked && 'opacity-70', dropLine(position))} {...dropProps} data-rule={id}>
        <div className="grid grid-cols-[minmax(0,1.1fr)_minmax(8.5rem,0.6fr)_minmax(0,1.1fr)_auto] items-center gap-2">
          {left}
          <CossSelect className="w-full min-w-0" items={operators} value={rule.operator} disabled={!can.editOperator} onChange={r.setOperator} />
          {editor.arity === 'none' ? <span /> : right}
          <div className="flex items-center">
            {showLock && <LockToggle locked={!!rule.locked} disabled={!can.lock} onChange={r.setLocked} what="rule" />}
            <Tip label="Remove rule">
              <Button size="icon-sm" variant="ghost" aria-label="Remove rule" disabled={!can.remove} onClick={r.remove}>
                <XIcon />
              </Button>
            </Tip>
          </div>
        </div>
        {errorLine}
      </div>
    );
  }

  return (
    <div className={cn('group/rule flex flex-col gap-1 rounded-lg', isDragging && 'opacity-40', locked && 'opacity-70', dropLine(position))} {...dropProps} data-rule={id}>
      <div className="flex items-start gap-2">
        <Tip label="Drag to move">
          <span {...handleProps} className="mt-2 cursor-grab text-muted-foreground/60 hover:text-foreground">
            <GripVerticalIcon className="size-4" />
          </span>
        </Tip>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
          {lhsFunctions.length > 0 && (
            <Tip label={fieldIsFn ? 'Use a field on the left' : 'Use a function on the left, e.g. lowercase(Name)'}>
              <Toggle
                size="sm"
                className="px-1.5 text-muted-foreground/70 data-pressed:text-foreground"
                aria-label="Function on the left"
                pressed={fieldIsFn}
                disabled={!can.editField}
                onPressedChange={(on) => r.setField(on ? defaultCall(fields, lhsFunctions[0]!.value) : r.fieldOptions[0]!.value)}
              >
                <SquareFunctionIcon />
              </Toggle>
            </Tip>
          )}
          {left}
          <CossSelect items={operators} value={rule.operator} disabled={!can.editOperator} onChange={r.setOperator} />
          {editor.arity !== 'none' && (
            <SourceSwitch
              value={source}
              available={sources}
              disabled={!can.editValue}
              onChange={(s) => (s === 'field' ? r.setRef(refOptions[0]!.value) : s === 'function' ? r.setCall(defaultCall(fields, fnOptions[0]!.value)) : r.setRef(null))}
            />
          )}
          {right}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-60 transition-opacity group-hover/rule:opacity-100">
          {showLock && <LockToggle locked={!!rule.locked} disabled={!can.lock} onChange={r.setLocked} what="rule" />}
          <Tip label="Duplicate rule">
            <Button size="icon-sm" variant="ghost" aria-label="Duplicate rule" disabled={!can.clone} onClick={r.clone}>
              <CopyIcon />
            </Button>
          </Tip>
          <Tip label="Remove rule">
            <Button size="icon-sm" variant="ghost" aria-label="Remove rule" disabled={!can.remove} onClick={r.remove}>
              <XIcon />
            </Button>
          </Tip>
        </div>
      </div>
      {errorLine}
    </div>
  );
});

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
const COUNT_OPS: Item[] = [
  { value: 'gte', label: 'at least' },
  { value: 'lte', label: 'at most' },
  { value: 'eq', label: 'exactly' },
  { value: 'gt', label: 'more than' },
  { value: 'lt', label: 'fewer than' },
];

/** "[some ▾] of Orders where" / "[at least ▾] [3] of Orders where" for array groups. */
function MatchEditor({ match, label, onChange, disabled }: { match: Quantifier; label: string; onChange: (m: Quantifier) => void; disabled?: boolean }) {
  const mode = typeof match === 'string' ? match : 'count';
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-sm" data-match={mode}>
      <CossSelect
        className="min-w-24"
        items={MATCH_MODES}
        value={mode}
        disabled={disabled}
        onChange={(m) => onChange(m === 'count' ? { count: 'gte', value: 1 } : (m as 'some' | 'all' | 'none'))}
      />
      {typeof match === 'object' && match.count !== 'between' && (
        <>
          <CossSelect className="min-w-28" items={COUNT_OPS} value={match.count} disabled={disabled} onChange={(count) => onChange({ count: count as 'gte', value: match.value })} />
          <NumberField size="sm" className="w-20" min={0} value={match.value} disabled={disabled} onValueChange={(v) => onChange({ count: match.count, value: v ?? 0 })}>
            <NumberFieldGroup>
              <NumberFieldInput aria-label="Count" />
            </NumberFieldGroup>
          </NumberField>
        </>
      )}
      <span className="text-muted-foreground">of</span>
      <Badge variant="info">{label}</Badge>
      <span className="text-muted-foreground">where</span>
    </span>
  );
}

function AddListCondition({ fields, onAdd, disabled, ghost }: { fields: readonly { value: string; label: string }[]; onAdd: (field: string) => void; disabled?: boolean; ghost?: boolean }) {
  const { labels } = useOptions();
  if (!fields.length) return null;
  return (
    <Menu>
      <Tip label="Match rows in a list field: some / all / none / a count of them">
        <MenuTrigger
          disabled={disabled}
          render={<Button size="sm" variant="ghost" className={ghost ? 'justify-start text-muted-foreground hover:text-foreground' : undefined} />}
        >
          <ListTreeIcon /> {labels.addArrayGroup}
        </MenuTrigger>
      </Tip>
      <MenuPopup align="end">
        <MenuGroup>
          <MenuGroupLabel>Match items in</MenuGroupLabel>
          {fields.map((o) => (
            <MenuItem key={o.value} onClick={() => onAdd(o.value)}>
              {o.label}
            </MenuItem>
          ))}
        </MenuGroup>
      </MenuPopup>
    </Menu>
  );
}

type Mode = 'all' | 'any' | 'none';
const modeOf = (combinator: string, not: boolean): Mode | null => (not ? (combinator === 'or' ? 'none' : null) : combinator === 'and' ? 'all' : 'any');

/** "If [all | any | none] of these rules are met": all = AND, any = OR, none = NOT (… OR …). */
function SentenceHeader({ id }: { id: NodeId }) {
  const { labels, sentenceIcon } = useOptions();
  const { group, setCombinator, setNot, can } = useGroup(id);
  const mode = modeOf(group.combinator, group.not);
  const store = useStore();
  const pick = (m: Mode) =>
    store.batch(() => {
      setCombinator(m === 'all' ? 'and' : 'or');
      setNot(m === 'none');
    });
  const item = 'h-7 rounded-md px-3 data-pressed:bg-background data-pressed:shadow-xs/5';
  return (
    <div className="flex flex-wrap items-center gap-2.5 text-sm">
      {sentenceIcon}
      <span className="font-medium">{labels.sentenceBefore}</span>
      <ToggleGroup size="sm" className="rounded-lg bg-muted p-0.5" disabled={!can.editGroup} value={mode ? [mode] : []} onValueChange={(v) => v[0] && pick(v[0] as Mode)}>
        <Tip label="Every rule must match">
          <ToggleGroupItem value="all" className={item}>
            all
          </ToggleGroupItem>
        </Tip>
        <Tip label="At least one rule must match">
          <ToggleGroupItem value="any" className={item}>
            any
          </ToggleGroupItem>
        </Tip>
        <Tip label="No rule may match">
          <ToggleGroupItem value="none" className={item}>
            none
          </ToggleGroupItem>
        </Tip>
      </ToggleGroup>
      <span className="font-medium">{labels.sentenceAfter}</span>
    </div>
  );
}

const Group = memo(function Group({ id, depth }: { id: NodeId; depth: number }) {
  const store = useStore();
  const { combinatorStyle, compact, allowGroups, showNot, showLock, labels } = useOptions();
  const g = useGroup(id);
  const { group, isRoot, can, locked } = g;
  const { isDragging, handleProps } = useDragHandle(id);
  const { position, dropProps } = useDropTarget(id);
  const { isOver, zoneProps } = useGroupDropZone(id);
  const sentence = combinatorStyle === 'sentence';
  const arrayLabel = group.of ? fieldLabel(group.of.field, (isRoot ? store.fields : store.fieldsFor(id))[group.of.field]) : '';
  const arrayFields = useMemo(() => g.arrayFields.map((o) => ({ value: o.value, label: o.label })), [g.arrayFields]);

  const children = (
    <div className={cn('flex flex-col gap-2', !isRoot && !sentence && 'ps-2', isOver && 'rounded-lg outline-2 outline-dashed outline-primary')} {...zoneProps}>
      {group.children.length === 0 && !sentence ? (
        <p className="rounded-lg border border-dashed px-3 py-4 text-center text-muted-foreground text-sm">{labels.empty}</p>
      ) : (
        group.children.map((c) => <NodeView key={c} id={c} depth={depth + 1} />)
      )}
    </div>
  );

  if (sentence) {
    return (
      <div className={cn('flex flex-col gap-3', !isRoot && 'rounded-xl border bg-background p-3', group.of && 'border-info/40', dropLine(position))} {...(isRoot ? {} : dropProps)} data-group={id}>
        <div className="flex flex-wrap items-center gap-2">
          {group.of && <MatchEditor match={group.of.match} label={arrayLabel} onChange={g.setMatch} disabled={!can.editGroup} />}
          <SentenceHeader id={id} />
          <div className="ms-auto flex items-center">
            {showLock && <LockToggle locked={!!group.locked} disabled={!can.lock} onChange={g.setLocked} what="group" />}
            {!isRoot && (
              <Tip label="Remove group">
                <Button size="icon-sm" variant="ghost" aria-label="Remove group" disabled={!can.remove} onClick={g.remove}>
                  <XIcon />
                </Button>
              </Tip>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-1 rounded-xl bg-muted/60 p-2 dark:bg-muted/30">
          {group.children.length > 0 && <div className="p-1">{children}</div>}
          <div className="flex flex-wrap items-center gap-1">
            <Button size="sm" variant="ghost" className="justify-start text-muted-foreground hover:text-foreground" disabled={!can.addRule} onClick={() => g.addRule()}>
              <PlusIcon /> {labels.addRule}
            </Button>
            {allowGroups && (
              <Button size="sm" variant="ghost" className="justify-start text-muted-foreground hover:text-foreground" disabled={!can.addGroup} onClick={() => g.addGroup()}>
                <FolderPlusIcon /> {labels.addGroup}
              </Button>
            )}
            {allowGroups && <AddListCondition ghost fields={arrayFields} disabled={!can.addGroup} onAdd={(f) => g.addArrayGroup(f)} />}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-3',
        depth % 2 === 0 ? 'bg-muted/40' : 'bg-background',
        group.of && 'border-info/50',
        group.not && 'border-dashed border-warning/60',
        locked && 'opacity-80',
        isDragging && 'opacity-40',
        dropLine(position),
      )}
      style={isRoot ? undefined : { contentVisibility: 'auto', containIntrinsicSize: 'auto 160px' }}
      {...(isRoot ? {} : dropProps)}
      data-group={id}
    >
      <div className="flex flex-wrap items-center gap-2">
        {!isRoot && !compact && (
          <Tip label="Drag to move">
            <span {...handleProps} className="cursor-grab text-muted-foreground/60 hover:text-foreground">
              <GripVerticalIcon className="size-4" />
            </span>
          </Tip>
        )}
        {group.of && <MatchEditor match={group.of.match} label={arrayLabel} onChange={g.setMatch} disabled={!can.editGroup} />}
        {showNot && (
          <Tip label={group.not ? 'Negated: matches when this group does NOT match' : 'Negate this group'}>
            <Toggle size="sm" variant="outline" pressed={group.not} disabled={!can.editGroup} onPressedChange={g.setNot}>
              NOT
            </Toggle>
          </Tip>
        )}
        <ToggleGroup size="sm" variant="outline" value={[group.combinator]} disabled={!can.editGroup} onValueChange={(v) => v[0] && g.setCombinator(v[0] as 'and' | 'or')}>
          <Tip label="Match when every rule matches">
            <ToggleGroupItem value="and">AND</ToggleGroupItem>
          </Tip>
          <Tip label="Match when any rule matches">
            <ToggleGroupItem value="or">OR</ToggleGroupItem>
          </Tip>
        </ToggleGroup>
        <div className="ms-auto flex flex-wrap items-center gap-1">
          <Tip label="Add a rule to this group">
            <Button size="sm" variant="outline" disabled={!can.addRule} onClick={() => g.addRule()}>
              <PlusIcon /> {labels.addRule}
            </Button>
          </Tip>
          {allowGroups && (
            <Tip label="Add a nested group">
              <Button size="sm" variant="ghost" disabled={!can.addGroup} onClick={() => g.addGroup()}>
                <FolderPlusIcon /> {labels.addGroup}
              </Button>
            </Tip>
          )}
          {allowGroups && <AddListCondition fields={arrayFields} disabled={!can.addGroup} onAdd={(f) => g.addArrayGroup(f)} />}
          {showLock && <LockToggle locked={!!group.locked} disabled={!can.lock} onChange={g.setLocked} what="group" />}
          {!isRoot && (
            <>
              {!compact && (
                <Tip label="Duplicate group">
                  <Button size="icon-sm" variant="ghost" aria-label="Duplicate group" disabled={!can.clone} onClick={g.clone}>
                    <CopyIcon />
                  </Button>
                </Tip>
              )}
              <Tip label="Remove group and its rules">
                <Button size="icon-sm" variant="ghost" aria-label="Remove group" disabled={!can.remove} onClick={g.remove}>
                  <XIcon />
                </Button>
              </Tip>
            </>
          )}
        </div>
      </div>
      {children}
    </div>
  );
});

export function CossQueryBuilder({ store, className, ...options }: { store: QueryStore<any, any>; className?: string } & CossQueryBuilderOptions) {
  const { combinatorStyle = 'toggle', compact = false, allowGroups = true, showNot = true, showLock = false, sentenceIcon = null, labels } = options;
  const ctx = useMemo<Ctx>(
    () => ({ combinatorStyle, compact, allowGroups, showNot, showLock, sentenceIcon, labels: { ...DEFAULT_LABELS, ...labels } }),
    // Labels are usually an inline object literal; compare by content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [combinatorStyle, compact, allowGroups, showNot, showLock, sentenceIcon, JSON.stringify(labels)],
  );
  return (
    <QueryProvider store={store}>
      <OptionsContext.Provider value={ctx}>
        <TooltipProvider delay={300}>
          <div className={className}>
            <Group id={store.rootId} depth={0} />
          </div>
        </TooltipProvider>
      </OptionsContext.Provider>
    </QueryProvider>
  );
}
