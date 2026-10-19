'use client';
import { fieldLabel, compile, OPERATORS, type NodeId } from '@trawlnet/core';
import { QueryProvider, useGroup, useRule, useStore } from '@trawlnet/react';
import { CircleDashedIcon, CircleDotIcon, CircleIcon, CheckCircle2Icon, FilterIcon, PlusIcon, SignalHighIcon, SignalLowIcon, SignalMediumIcon, TriangleAlertIcon, XIcon } from 'lucide-react';
import { useMemo } from 'react';
import { defineFields, f } from '@trawlnet/core';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Menu, MenuCheckboxItem, MenuGroup, MenuGroupLabel, MenuItem, MenuPopup, MenuRadioGroup, MenuRadioItem, MenuTrigger } from '@/components/ui/menu';
import { NumberField, NumberFieldGroup, NumberFieldInput } from '@/components/ui/number-field';
import { Popover, PopoverPopup, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { pickWith, rng, useExampleStore, useLiveQuery } from './shared';



const STATUS = ['Backlog', 'Todo', 'In progress', 'In review', 'Done'] as const;
const PRIORITY = ['Urgent', 'High', 'Medium', 'Low'] as const;
const PEOPLE = ['Ada', 'Grace', 'Linus', 'Radia', 'Ken'] as const;
const LABELS = ['Bug', 'Feature', 'Perf', 'Docs', 'Design'] as const;

const fields = defineFields({
  status: f.enum(STATUS, { operators: ['in', 'notIn'] }),
  priority: f.enum(PRIORITY, { operators: ['in', 'notIn'] }),
  assignee: f.enum(PEOPLE, { operators: ['in', 'notIn', 'isNull'] }),
  label: f.enum(LABELS, { operators: ['in', 'notIn'] }),
  estimate: f.number({ label: 'Estimate', operators: ['gte', 'lte', 'eq'] }),
});

const TITLES = ['Query builder drops focus on paste', 'Add keyboard shortcuts to filter bar', 'SQL export escapes LIKE wildcards', 'Dark mode contrast on chips', 'Memoize codec output per node', 'Docs: drop-in migration guide', 'Virtualize 5k-rule trees', 'Combobox chips overflow on mobile', 'Undo merges keystrokes per field', 'Mongo $elemMatch for array groups', 'Flaky DnD test in Safari', 'Typed RowOf for nested paths'];
const rand = rng(11);
const pick = pickWith(rand);
const ISSUES = TITLES.map((title, i) => ({
  id: `TRW-${101 + i}`,
  title,
  status: pick(STATUS),
  priority: pick(PRIORITY),
  assignee: rand() < 0.15 ? null : pick(PEOPLE),
  label: pick(LABELS),
  estimate: [1, 2, 3, 5, 8][Math.floor(rand() * 5)]!,
}));

const STATUS_ICON = { Backlog: CircleDashedIcon, Todo: CircleIcon, 'In progress': CircleDotIcon, 'In review': CircleDotIcon, Done: CheckCircle2Icon } as const;
const PRIORITY_ICON = { Urgent: TriangleAlertIcon, High: SignalHighIcon, Medium: SignalMediumIcon, Low: SignalLowIcon } as const;

/** One filter as a chip: [Field] [operator ▾] [values ▾] [×]. */
function Chip({ id }: { id: NodeId }) {
  const store = useStore<typeof fields>();
  const { rule, def, operators, setOperator, setValue, remove } = useRule<typeof fields>(id);
  const field = rule.field as keyof typeof fields;
  const values = Array.isArray(rule.value) ? (rule.value as unknown[]) : [];
  const valueText =
    rule.operator === 'isNull'
      ? null
      : def?.options
        ? values.length === 0
          ? 'any value'
          : values.length <= 2
            ? values.join(', ')
            : `${values.length} ${fieldLabel(field, def).toLowerCase()}s`
        : rule.value == null
          ? '…'
          : String(rule.value);
  const part = 'flex h-7 items-center gap-1 px-2 text-sm hover:bg-accent';
  return (
    <div className="flex items-center overflow-hidden rounded-lg border bg-background shadow-xs/5" data-chip>
      <span className="flex h-7 items-center gap-1.5 border-e px-2 font-medium text-sm">{fieldLabel(field, store.fields[field])}</span>
      <Menu>
        <MenuTrigger className={cn(part, 'border-e text-muted-foreground')}>{OPERATORS[rule.operator as keyof typeof OPERATORS]?.label ?? rule.operator}</MenuTrigger>
        <MenuPopup align="start">
          <MenuRadioGroup value={rule.operator} onValueChange={(v) => setOperator(String(v))}>
            {operators.map((o) => (
              <MenuRadioItem key={o.value} value={o.value}>
                {o.label}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuPopup>
      </Menu>
      {valueText !== null &&
        (def?.options ? (
          <Menu>
            <MenuTrigger className={cn(part, 'border-e')}>{valueText}</MenuTrigger>
            <MenuPopup align="start">
              {def.options.map((o: { value: unknown; label: string }) => (
                <MenuCheckboxItem
                  key={String(o.value)}
                  checked={values.includes(o.value)}
                  closeOnClick={false}
                  onCheckedChange={(on) => setValue(on ? [...values, o.value] : values.filter((v) => v !== o.value))}
                >
                  {o.label}
                </MenuCheckboxItem>
              ))}
            </MenuPopup>
          </Menu>
        ) : (
          <Popover>
            <PopoverTrigger className={cn(part, 'border-e tabular-nums')}>{valueText} pts</PopoverTrigger>
            <PopoverPopup className="w-40">
              <NumberField value={typeof rule.value === 'number' ? rule.value : null} onValueChange={(v) => setValue(v)} min={0}>
                <NumberFieldGroup>
                  <NumberFieldInput autoFocus aria-label="Estimate" />
                </NumberFieldGroup>
              </NumberField>
            </PopoverPopup>
          </Popover>
        ))}
      <button type="button" aria-label="Remove filter" onClick={remove} className="flex h-7 items-center px-1.5 text-muted-foreground hover:bg-accent hover:text-foreground">
        <XIcon className="size-3.5" />
      </button>
    </div>
  );
}

function FilterBar() {
  const store = useStore<typeof fields>();
  const { group, addRule } = useGroup(store.rootId);
  const used = new Set(group.children.map((c) => (store.get(c) as { field?: string })?.field));
  return (
    <div className="flex flex-wrap items-center gap-2">
      {group.children.map((c) => (
        <Chip key={c} id={c} />
      ))}
      <Menu>
        <MenuTrigger render={<Button size="sm" variant="ghost" className="text-muted-foreground" />}>
          {group.children.length ? <PlusIcon /> : <FilterIcon />}
          {group.children.length ? 'Filter' : 'Add filter'}
        </MenuTrigger>
        <MenuPopup align="start">
          <MenuGroup>
            <MenuGroupLabel>Filter by</MenuGroupLabel>
            {(Object.keys(fields) as (keyof typeof fields)[]).map((name) => (
              <MenuItem key={name} disabled={used.has(name)} onClick={() => addRule(fields[name].kind === 'number' ? { field: name, operator: 'gte', value: 3 } : { field: name, operator: 'in', value: [] })}>
                {fieldLabel(name, fields[name])}
              </MenuItem>
            ))}
          </MenuGroup>
        </MenuPopup>
      </Menu>
      {group.children.length > 0 && (
        <Button size="sm" variant="ghost" className="ms-auto text-muted-foreground" onClick={() => store.clear()}>
          Clear
        </Button>
      )}
    </div>
  );
}

function IssueList() {
  const store = useStore<typeof fields>();
  const query = useLiveQuery(store);
  const rows = useMemo(() => ISSUES.filter(compile(fields, query)), [query]);
  return (
    <div className="overflow-hidden rounded-xl border">
      <div className="flex items-center gap-2 border-b bg-muted/40 px-3 py-2 text-muted-foreground text-xs">
        <span>Issues</span>
        <Badge variant="outline">{rows.length}</Badge>
      </div>
      {rows.length === 0 && <p className="px-3 py-8 text-center text-muted-foreground text-sm">No issues match these filters.</p>}
      {rows.map((i) => {
        const S = STATUS_ICON[i.status];
        const P = PRIORITY_ICON[i.priority];
        return (
          <div key={i.id} className="flex items-center gap-3 border-b px-3 py-2 text-sm last:border-b-0">
            <P className="size-4 text-muted-foreground" />
            <span className="w-16 text-muted-foreground text-xs tabular-nums">{i.id}</span>
            <S className={cn('size-4', i.status === 'Done' ? 'text-success-foreground' : i.status === 'In progress' || i.status === 'In review' ? 'text-warning-foreground' : 'text-muted-foreground')} />
            <span className="truncate">{i.title}</span>
            <Badge variant="outline" className="ms-auto hidden sm:inline-flex">
              {i.label}
            </Badge>
            <span className="w-8 text-end text-muted-foreground text-xs tabular-nums">{i.estimate}pt</span>
            <span className="flex size-6 items-center justify-center rounded-full bg-muted font-medium text-[10px]">{i.assignee?.slice(0, 2) ?? '–'}</span>
          </div>
        );
      })}
    </div>
  );
}


export function Demo() {
  const store = useExampleStore(fields, {
    kind: 'group',
    combinator: 'and',
    children: [{ kind: 'rule', field: 'status', operator: 'in', value: ['Todo', 'In progress'] }],
  });
  return (
    <>
      <QueryProvider store={store}>
        <div className="flex flex-col gap-3">
          <FilterBar />
          <IssueList />
        </div>
      </QueryProvider>
    </>
  );
}
