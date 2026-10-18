// A trawlnet query builder made entirely of coss ui components, on top of @trawlnet/react's
// headless hooks. Nothing here touches the store directly except through those hooks, so this file
// doubles as the "bring your own UI kit" recipe.
import { fieldOptions, refOptions, type NodeId, type QueryStore } from '@trawlnet/core';
import { QueryProvider, useDragHandle, useDropTarget, useGroup, useGroupDropZone, useNode, useRule, useStore } from '@trawlnet/react';
import { CopyIcon, FolderPlusIcon, GripVerticalIcon, PencilLineIcon, PlusIcon, VariableIcon, XIcon } from 'lucide-react';
import { createContext, memo, useContext, useMemo, type ReactNode } from 'react';
import { Tip } from '@/components/tip';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { CossSelect, ValueEditor, type Item } from './controls';

export interface CossQueryBuilderOptions {
  /** `toggle`: NOT + AND/OR buttons. `sentence`: "If [all | any | none] of these rules are met". */
  combinatorStyle?: 'toggle' | 'sentence';
  /** Full-width rule rows with only field, operator, value and remove (no drag, duplicate or field refs). */
  compact?: boolean;
  /** Offer "+ Group" (nested groups). Default true. */
  allowGroups?: boolean;
  /** Icon shown before the sentence header. */
  sentenceIcon?: ReactNode;
  labels?: Partial<Labels>;
}

const DEFAULT_LABELS = {
  addRule: 'Rule',
  addGroup: 'Group',
  field: 'Select a field',
  value: 'Choose…',
  valueText: 'Enter a value',
  sentenceBefore: 'If',
  sentenceAfter: 'of these rules are met',
  empty: 'Empty group: add a rule or drag one here.',
};
type Labels = typeof DEFAULT_LABELS;

interface Ctx extends Required<Omit<CossQueryBuilderOptions, 'sentenceIcon' | 'labels'>> {
  labels: Labels;
  sentenceIcon: ReactNode;
  fields: Item[];
}
const OptionsContext = createContext<Ctx>(null!);
const useOptions = () => useContext(OptionsContext);

const dropLine = (position: 'before' | 'after' | 'inside' | null) =>
  position === 'before' ? 'shadow-[0_-2px_0_var(--color-primary)]' : position === 'after' ? 'shadow-[0_2px_0_var(--color-primary)]' : '';

const Rule = memo(function Rule({ id }: { id: NodeId }) {
  const store = useStore();
  const { fields, compact, labels } = useOptions();
  const { rule, def, editor, operators, issues, setField, setOperator, setValue, setRef, remove, clone } = useRule(id);
  const { isDragging, handleProps } = useDragHandle(id);
  const { position, dropProps } = useDropTarget(id);
  // Left-hand function calls (RAQB fieldSources: func) aren't editable in this recipe; show them as unset.
  const field = typeof rule.field === 'string' ? rule.field : null;
  const refs = useMemo(() => (editor.allowsRef && !compact && field ? refOptions(store.fields, field) : []), [store, editor.allowsRef, field, compact]);
  const errors = issues.filter((i) => i.severity === 'error');
  const invalid = errors.length > 0;

  if (compact) {
    return (
      <div className={cn('grid grid-cols-[minmax(0,1.1fr)_minmax(0,0.55fr)_minmax(0,1.1fr)_auto] items-center gap-2', dropLine(position))} {...dropProps}>
        <CossSelect className="w-full" items={fields} value={field} onChange={(f) => setField(f)} placeholder={labels.field} />
        <CossSelect className="w-full min-w-0" items={operators} value={rule.operator} onChange={(op) => setOperator(op as typeof rule.operator)} />
        {editor.arity === 'none' ? (
          <span />
        ) : (
          <ValueEditor fluid editor={editor} def={def} value={rule.value} onChange={setValue} invalid={invalid} placeholder={labels.value} textPlaceholder={labels.valueText} />
        )}
        <Tip label="Remove rule">
          <Button size="icon-sm" variant="ghost" aria-label="Remove rule" onClick={remove}>
            <XIcon />
          </Button>
        </Tip>
      </div>
    );
  }

  return (
    <div className={cn('group/rule flex flex-col gap-1 rounded-lg', isDragging && 'opacity-40', dropLine(position))} {...dropProps}>
      <div className="flex flex-wrap items-center gap-2">
        <Tip label="Drag to move">
          <span {...handleProps} className="cursor-grab text-muted-foreground/60 hover:text-foreground">
            <GripVerticalIcon className="size-4" />
          </span>
        </Tip>
        <CossSelect items={fields} value={field} onChange={(f) => setField(f)} />
        <CossSelect items={operators} value={rule.operator} onChange={(op) => setOperator(op as typeof rule.operator)} />
        {rule.ref !== undefined ? (
          <CossSelect items={refs} value={rule.ref} onChange={(r) => setRef(r)} />
        ) : (
          <ValueEditor editor={editor} def={def} value={rule.value} onChange={setValue} invalid={invalid} />
        )}
        <div className="ms-auto flex items-center gap-0.5 opacity-60 transition-opacity group-hover/rule:opacity-100">
          {refs.length > 0 && (
            <Tip label={rule.ref === undefined ? 'Compare with another field' : 'Compare with a value'}>
              <Button size="icon-sm" variant="ghost" aria-label={rule.ref === undefined ? 'Compare with another field' : 'Compare with a value'} onClick={() => setRef(rule.ref === undefined ? refs[0]!.value : null)}>
                {rule.ref === undefined ? <VariableIcon /> : <PencilLineIcon />}
              </Button>
            </Tip>
          )}
          <Tip label="Duplicate rule">
            <Button size="icon-sm" variant="ghost" aria-label="Duplicate rule" onClick={clone}>
              <CopyIcon />
            </Button>
          </Tip>
          <Tip label="Remove rule">
            <Button size="icon-sm" variant="ghost" aria-label="Remove rule" onClick={remove}>
              <XIcon />
            </Button>
          </Tip>
        </div>
      </div>
      {invalid && <p className="ps-6 text-destructive-foreground text-xs">{errors.map((e) => e.message).join(' · ')}</p>}
    </div>
  );
});

function NodeView({ id, depth }: { id: NodeId; depth: number }) {
  const kind = useNode(id)?.kind;
  return kind === 'group' ? <Group id={id} depth={depth} /> : <Rule id={id} />;
}

type Mode = 'all' | 'any' | 'none';
const modeOf = (combinator: string, not: boolean): Mode | null => (not ? (combinator === 'or' ? 'none' : null) : combinator === 'and' ? 'all' : 'any');

/** "If [all | any | none] of these rules are met": all = AND, any = OR, none = NOT (… OR …). */
function SentenceHeader({ id }: { id: NodeId }) {
  const { labels, sentenceIcon } = useOptions();
  const { group, setCombinator, setNot } = useGroup(id);
  const mode = modeOf(group.combinator, group.not);
  const store = useStore();
  const pick = (m: Mode) =>
    store.batch(() => {
      setCombinator(m === 'all' ? 'and' : 'or');
      setNot(m === 'none');
    });
  return (
    <div className="flex flex-wrap items-center gap-2.5 text-sm">
      {sentenceIcon}
      <span className="font-medium">{labels.sentenceBefore}</span>
      <ToggleGroup size="sm" className="rounded-lg bg-muted p-0.5" value={mode ? [mode] : []} onValueChange={(v) => v[0] && pick(v[0] as Mode)}>
        <Tip label="Every rule must match">
          <ToggleGroupItem value="all" className="h-7 rounded-md px-3 data-pressed:bg-background data-pressed:shadow-xs/5">
            all
          </ToggleGroupItem>
        </Tip>
        <Tip label="At least one rule must match">
          <ToggleGroupItem value="any" className="h-7 rounded-md px-3 data-pressed:bg-background data-pressed:shadow-xs/5">
            any
          </ToggleGroupItem>
        </Tip>
        <Tip label="No rule may match">
          <ToggleGroupItem value="none" className="h-7 rounded-md px-3 data-pressed:bg-background data-pressed:shadow-xs/5">
            none
          </ToggleGroupItem>
        </Tip>
      </ToggleGroup>
      <span className="font-medium">{labels.sentenceAfter}</span>
    </div>
  );
}

const Group = memo(function Group({ id, depth }: { id: NodeId; depth: number }) {
  const { combinatorStyle, compact, allowGroups, labels } = useOptions();
  const { group, isRoot, setCombinator, setNot, addRule, addGroup, remove, clone } = useGroup(id);
  const { isDragging, handleProps } = useDragHandle(id);
  const { position, dropProps } = useDropTarget(id);
  const { isOver, zoneProps } = useGroupDropZone(id);
  const sentence = combinatorStyle === 'sentence';

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
      <div className={cn('flex flex-col gap-3', !isRoot && 'rounded-xl border bg-background p-3', dropLine(position))} {...(isRoot ? {} : dropProps)}>
        <div className="flex items-center gap-2">
          <SentenceHeader id={id} />
          {!isRoot && (
            <Tip label="Remove group">
              <Button size="icon-sm" variant="ghost" className="ms-auto" aria-label="Remove group" onClick={remove}>
                <XIcon />
              </Button>
            </Tip>
          )}
        </div>
        <div className="flex flex-col gap-1 rounded-xl bg-muted/60 p-2 dark:bg-muted/30">
          {group.children.length > 0 && <div className="p-1">{children}</div>}
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="justify-start text-muted-foreground hover:text-foreground" onClick={() => addRule()}>
              <PlusIcon /> {labels.addRule}
            </Button>
            {allowGroups && (
              <Button size="sm" variant="ghost" className="justify-start text-muted-foreground hover:text-foreground" onClick={() => addGroup()}>
                <FolderPlusIcon /> {labels.addGroup}
              </Button>
            )}
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
        group.not && 'border-dashed border-warning/60',
        isDragging && 'opacity-40',
        dropLine(position),
      )}
      style={isRoot ? undefined : { contentVisibility: 'auto', containIntrinsicSize: 'auto 160px' }}
      {...(isRoot ? {} : dropProps)}
    >
      <div className="flex flex-wrap items-center gap-2">
        {!isRoot && !compact && (
          <Tip label="Drag to move">
            <span {...handleProps} className="cursor-grab text-muted-foreground/60 hover:text-foreground">
              <GripVerticalIcon className="size-4" />
            </span>
          </Tip>
        )}
        <Tip label={group.not ? 'Negated: matches when this group does NOT match' : 'Negate this group'}>
          <Toggle size="sm" variant="outline" pressed={group.not} onPressedChange={setNot}>
            NOT
          </Toggle>
        </Tip>
        <ToggleGroup size="sm" variant="outline" value={[group.combinator]} onValueChange={(v) => v[0] && setCombinator(v[0] as 'and' | 'or')}>
          <Tip label="Match when every rule matches">
            <ToggleGroupItem value="and">AND</ToggleGroupItem>
          </Tip>
          <Tip label="Match when any rule matches">
            <ToggleGroupItem value="or">OR</ToggleGroupItem>
          </Tip>
        </ToggleGroup>
        <div className="ms-auto flex items-center gap-1">
          <Tip label="Add a rule to this group">
            <Button size="sm" variant="outline" onClick={() => addRule()}>
              <PlusIcon /> {labels.addRule}
            </Button>
          </Tip>
          {allowGroups && (
            <Tip label="Add a nested group">
              <Button size="sm" variant="ghost" onClick={() => addGroup()}>
                <FolderPlusIcon /> {labels.addGroup}
              </Button>
            </Tip>
          )}
          {!isRoot && (
            <>
              {!compact && (
                <Tip label="Duplicate group">
                  <Button size="icon-sm" variant="ghost" aria-label="Duplicate group" onClick={clone}>
                    <CopyIcon />
                  </Button>
                </Tip>
              )}
              <Tip label="Remove group and its rules">
                <Button size="icon-sm" variant="ghost" aria-label="Remove group" onClick={remove}>
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
  const fields = useMemo(() => fieldOptions(store.fields), [store]);
  const { combinatorStyle = 'toggle', compact = false, allowGroups = true, sentenceIcon = null, labels } = options;
  const ctx = useMemo<Ctx>(
    () => ({ combinatorStyle, compact, allowGroups, sentenceIcon, labels: { ...DEFAULT_LABELS, ...labels }, fields }),
    // Labels are usually an inline object literal; compare by content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [combinatorStyle, compact, allowGroups, sentenceIcon, JSON.stringify(labels), fields],
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
