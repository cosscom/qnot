// Part of qnot (https://github.com/cosscom/qnot). MIT licensed; installable with shadcn.
// qnot's query builder in shadcn/ui: Radix-based Select, Command-in-Popover comboboxes,
// ToggleGroup segments and Tooltips, on @qnot/react's headless hooks. MIT licensed.
'use client';

import { CheckIcon, ChevronsUpDownIcon, CopyIcon, FolderPlusIcon, GripVerticalIcon, ListTreeIcon, LoaderIcon, LockIcon, LockOpenIcon, PlusIcon, SquareFunctionIcon, TypeIcon, VariableIcon, XIcon } from 'lucide-react';
import { Fragment, useMemo, useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { createQueryBuilder } from '@/components/qnot/kits/shared/builder';
import { useNumberDraft } from '@/components/qnot/kits/shared/draft';
import type { Item, Kit, Width } from '@/components/qnot/kits/shared/kit';
import { Badge } from '@/components/qnot/kits/shadcn-ui/badge';
import { Button } from '@/components/qnot/kits/shadcn-ui/button';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/qnot/kits/shadcn-ui/command';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from '@/components/qnot/kits/shadcn-ui/dropdown-menu';
import { Input } from '@/components/qnot/kits/shadcn-ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/qnot/kits/shadcn-ui/popover';
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/qnot/kits/shadcn-ui/select';
import { Slider } from '@/components/qnot/kits/shadcn-ui/slider';
import { Switch } from '@/components/qnot/kits/shadcn-ui/switch';
import { Textarea } from '@/components/qnot/kits/shadcn-ui/textarea';
import { Toggle } from '@/components/qnot/kits/shadcn-ui/toggle';
import { ToggleGroup, ToggleGroupItem } from '@/components/qnot/kits/shadcn-ui/toggle-group';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/qnot/kits/shadcn-ui/tooltip';

const WIDTH: Record<Width, string> = { auto: 'w-auto', full: 'w-full', xs: 'w-24', sm: 'w-36', md: 'w-44', lg: 'w-64' };
const w = (width: Width | undefined, fallback: Width = 'auto') => WIDTH[width ?? fallback];

function groupItems(items: readonly Item[]) {
  const out = new Map<string | undefined, Item[]>();
  for (const i of items) out.set(i.group, [...(out.get(i.group) ?? []), i]);
  return [...out];
}

const indent = (i: Item) => (i.depth ? { paddingInlineStart: `${0.5 + i.depth * 0.9}rem` } : undefined);

/** Popover + Command list: the shadcn "combobox" pattern, for multi-select and async search. */
function ComboboxPopover({
  trigger,
  items,
  selected,
  onToggle,
  search,
  loading,
  empty = 'No matches.',
  disabled,
  invalid,
  width,
  footer,
}: {
  trigger: ReactNode;
  items: readonly Item[];
  selected: (i: Item) => boolean;
  onToggle: (i: Item, close: () => void) => void;
  /** Server-side search: the input drives the query and Command doesn't filter. */
  search?: { onChange: (q: string) => void; placeholder?: string };
  loading?: boolean;
  empty?: string;
  disabled?: boolean;
  invalid?: boolean;
  width?: Width;
  footer?: (query: string, close: () => void) => ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const close = () => setOpen(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild disabled={disabled}>
        <Button variant="outline" role="combobox" aria-expanded={open} aria-invalid={invalid || undefined} className={cn('h-auto min-h-8 justify-between gap-2 px-2 py-1 font-normal', w(width, 'lg'))}>
          <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1 text-left">{trigger}</span>
          <ChevronsUpDownIcon className="size-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-(--radix-popover-trigger-width) min-w-56 p-0" align="start">
        <Command shouldFilter={!search}>
          <CommandInput
            placeholder={search?.placeholder ?? 'Search…'}
            value={query}
            onValueChange={(q) => {
              setQuery(q);
              search?.onChange(q);
            }}
          />
          <CommandList>
            {loading ? (
              <div className="flex items-center gap-2 px-3 py-2 text-muted-foreground text-sm">
                <LoaderIcon className="size-3.5 animate-spin" /> Searching…
              </div>
            ) : (
              <CommandEmpty>{empty}</CommandEmpty>
            )}
            {groupItems(items).map(([group, opts]) => (
              <CommandGroup key={group ?? '_'} heading={group}>
                {opts.map((i) => (
                  <CommandItem key={i.value} value={search ? i.value : `${i.label} ${i.value}`} disabled={i.disabled} style={indent(i)} onSelect={() => onToggle(i, close)}>
                    <CheckIcon className={cn('size-4', selected(i) ? 'opacity-100' : 'opacity-0')} />
                    <span className={cn(i.disabled && 'font-medium text-muted-foreground')}>{i.label}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
            {footer?.(query, close)}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

const chips = (items: readonly Item[], placeholder?: string) =>
  items.length ? (
    items.map((i) => (
      <Badge key={i.value} variant="secondary" className="rounded-sm px-1.5 font-normal">
        {i.label}
      </Badge>
    ))
  ) : (
    <span className="px-1 text-muted-foreground">{placeholder}</span>
  );

const kit: Kit = {
  name: 'shadcn',
  Provider: ({ children }) => <TooltipProvider delayDuration={300}>{children}</TooltipProvider>,

  Select({ items, value, onChange, disabled, invalid, placeholder, width, mono, label }) {
    return (
      <Select value={value ?? undefined} onValueChange={onChange} disabled={disabled}>
        <SelectTrigger size="sm" aria-label={label} aria-invalid={invalid || undefined} className={cn(w(width, 'auto'), 'min-w-0', mono && 'font-mono text-xs')}>
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {groupItems(items).map(([group, opts]) =>
            group === undefined ? (
              <Fragment key="_">
                {opts.map((i) => (
                  <SelectItem key={i.value} value={i.value} disabled={i.disabled} style={indent(i)} className={cn(mono && 'font-mono text-xs')}>
                    {i.label}
                  </SelectItem>
                ))}
              </Fragment>
            ) : (
              <SelectGroup key={group}>
                <SelectLabel>{group}</SelectLabel>
                {opts.map((i) => (
                  <SelectItem key={i.value} value={i.value} disabled={i.disabled} style={indent(i)}>
                    {i.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            ),
          )}
        </SelectContent>
      </Select>
    );
  },

  TextInput: ({ value, onChange, type = 'text', disabled, invalid, placeholder, width, label }) => (
    <Input type={type} value={value} aria-label={label} placeholder={placeholder} disabled={disabled} aria-invalid={invalid || undefined} className={cn('h-8', w(width, 'md'))} onChange={(e) => onChange(e.target.value)} />
  ),

  Textarea: ({ value, onChange, disabled, invalid, placeholder, width }) => (
    <Textarea value={value} rows={2} placeholder={placeholder} disabled={disabled} aria-invalid={invalid || undefined} className={cn('min-h-14', w(width, 'lg'))} onChange={(e) => onChange(e.target.value)} />
  ),

  NumberInput({ value, onChange, min, max, step, disabled, invalid, placeholder, width, prefix, suffix, label }) {
    const { draft, onDraftChange } = useNumberDraft(value, onChange);
    const input = (
      <Input type="number" inputMode="decimal" value={draft} min={min} max={max} step={step} aria-label={label} placeholder={placeholder} disabled={disabled} aria-invalid={invalid || undefined} className={cn('h-8', w(width, 'sm'))} onChange={(e) => onDraftChange(e.target.value)} />
    );
    if (!prefix && !suffix) return input;
    return (
      <span className="inline-flex items-center gap-1.5 text-sm">
        {prefix && <span className="text-muted-foreground">{prefix}</span>}
        {input}
        {suffix && <span className="text-muted-foreground">{suffix}</span>}
      </span>
    );
  },

  Slider: ({ value, min, max, step, onChange, disabled, label }) => (
    <span className="inline-flex w-56 items-center gap-3">
      <Slider className="flex-1" value={[value]} min={min} max={max} step={step} disabled={disabled} aria-label={label} onValueChange={(v) => onChange(v[0]!)} />
      <span className="w-8 text-end font-medium text-sm tabular-nums">{value}</span>
    </span>
  ),

  Switch: ({ checked, onChange, disabled, label }) => (
    <label className="inline-flex h-8 items-center gap-2 text-sm">
      <Switch checked={checked} disabled={disabled} onCheckedChange={onChange} />
      {label}
    </label>
  ),

  MultiSelect({ items, value, onChange, disabled, invalid, placeholder, width }) {
    const set = useMemo(() => new Set(value), [value]);
    return (
      <ComboboxPopover
        trigger={chips(
          items.filter((i) => set.has(i.value)),
          placeholder,
        )}
        items={items}
        selected={(i) => set.has(i.value)}
        onToggle={(i) => onChange(set.has(i.value) ? value.filter((v) => v !== i.value) : [...value, i.value])}
        disabled={disabled}
        invalid={invalid}
        width={width}
      />
    );
  },

  AsyncSelect({ multiple, items, loading, onQueryChange, value, onChange, disabled, invalid, placeholder, width, allowCustom }) {
    const chosen = new Set(value.map((i) => i.value));
    return (
      <ComboboxPopover
        trigger={multiple ? chips(value, placeholder) : value[0] ? <span className="truncate px-1">{value[0].label}</span> : <span className="px-1 text-muted-foreground">{placeholder}</span>}
        items={items}
        loading={loading}
        search={{ onChange: onQueryChange, placeholder }}
        selected={(i) => chosen.has(i.value)}
        onToggle={(i, close) => {
          if (!multiple) {
            onChange([i]);
            close();
          } else onChange(chosen.has(i.value) ? value.filter((v) => v.value !== i.value) : [...value, i]);
        }}
        footer={(query, close) =>
          allowCustom && query && !items.some((i) => i.label.toLowerCase() === query.toLowerCase()) ? (
            <CommandGroup>
              <CommandItem
                value={`custom:${query}`}
                onSelect={() => {
                  const custom = { value: query, label: query, raw: query };
                  onChange(multiple ? [...value, custom] : [custom]);
                  if (!multiple) close();
                }}
              >
                <PlusIcon className="size-4" /> Use “{query}”
              </CommandItem>
            </CommandGroup>
          ) : null
        }
        disabled={disabled}
        invalid={invalid}
        width={width}
      />
    );
  },

  Button: ({ children, icon, onClick, disabled, variant = 'outline' }) => (
    <Button size="sm" variant={variant} disabled={disabled} onClick={onClick}>
      {icon}
      {children}
    </Button>
  ),

  IconButton: ({ label, icon, onClick, disabled, pressed }) => (
    <Button size="icon-sm" variant="ghost" aria-label={label} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
      {icon}
    </Button>
  ),

  Toggle: ({ pressed, onChange, disabled, label, children }) => (
    <Toggle size="sm" variant="outline" aria-label={label} pressed={pressed} disabled={disabled} onPressedChange={onChange} className="data-[state=on]:border-amber-500/60 data-[state=on]:bg-amber-500/10">
      {children}
    </Toggle>
  ),

  Segmented: ({ items, value, onChange, disabled, label, compact }) => (
    <ToggleGroup type="single" size="sm" variant="outline" aria-label={label} value={value ?? ''} disabled={disabled} onValueChange={(v) => v && onChange(v)}>
      {items.map((i) => (
        <Tooltip key={i.value}>
          <TooltipTrigger asChild>
            <ToggleGroupItem
              value={i.value}
              aria-label={i.ariaLabel}
              data-source={i.value}
              // The tooltip trigger overwrites data-state, so selection is styled from aria-checked.
              className={cn('aria-checked:bg-foreground/10 aria-checked:text-foreground', compact && 'px-2')}
            >
              {i.label}
            </ToggleGroupItem>
          </TooltipTrigger>
          {i.tooltip && <TooltipContent>{i.tooltip}</TooltipContent>}
        </Tooltip>
      ))}
    </ToggleGroup>
  ),

  Tooltip: ({ label, children }) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex">{children}</span>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  ),

  Badge: ({ children }) => <Badge variant="secondary">{children}</Badge>,

  Menu({ trigger, heading, items, value, onSelect, disabled }) {
    const button = trigger.iconOnly ? (
      <Button size="icon-xs" variant="ghost" aria-label={trigger.label} disabled={disabled}>
        {trigger.icon}
      </Button>
    ) : (
      <Button size="sm" variant="ghost" disabled={disabled}>
        {trigger.icon}
        {trigger.label}
      </Button>
    );
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>{button}</DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {heading && <DropdownMenuLabel>{heading}</DropdownMenuLabel>}
          {value !== undefined ? (
            <DropdownMenuRadioGroup value={value} onValueChange={onSelect}>
              {items.map((i) => (
                <DropdownMenuRadioItem key={i.value} value={i.value}>
                  {i.label}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          ) : (
            items.map((i) => (
              <DropdownMenuItem key={i.value} onSelect={() => onSelect(i.value)}>
                {i.label}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  },

  Surface: ({ kind, depth, negated, locked, dragging, drop, className, children, ...rest }) => (
    <div
      {...rest}
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-3 text-sm',
        depth % 2 === 0 ? 'bg-muted/40' : 'bg-background',
        kind === 'array' && 'border-primary/30',
        negated && 'border-destructive/50 border-dashed',
        locked && 'opacity-80',
        dragging && 'opacity-40',
        drop === 'before' && 'shadow-[0_-2px_0_var(--color-primary)]',
        drop === 'after' && 'shadow-[0_2px_0_var(--color-primary)]',
        className,
      )}
    >
      {children}
    </div>
  ),

  Empty: ({ children }) => <p className="rounded-lg border border-dashed px-3 py-4 text-center text-muted-foreground text-sm">{children}</p>,
  ErrorText: ({ children }) => <p className="ps-6 text-destructive text-xs">{children}</p>,
  Muted: ({ children, mono }) => <span className={cn('text-muted-foreground text-sm', mono && 'font-mono')}>{children}</span>,
  FunctionFrame: ({ children, fn }) => (
    <span className="inline-flex flex-wrap items-center gap-1 rounded-md border border-dashed bg-muted/40 p-0.5 pe-2" data-function={fn}>
      {children}
    </span>
  ),

  icons: {
    grip: <GripVerticalIcon className="size-4" />,
    plus: <PlusIcon />,
    folderPlus: <FolderPlusIcon />,
    list: <ListTreeIcon />,
    copy: <CopyIcon />,
    remove: <XIcon />,
    lock: <LockIcon />,
    unlock: <LockOpenIcon />,
    fn: <SquareFunctionIcon />,
    value: <TypeIcon />,
    field: <VariableIcon />,
  },
};

/** The qnot query builder in shadcn/ui. Same props as the coss builder. */
export const QueryBuilder = createQueryBuilder(kit);

/** The kit's primitives, for building variants or tests. */
export { kit as shadcnKit };
