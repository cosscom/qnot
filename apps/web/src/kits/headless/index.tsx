// "Your own" UI: trawlnet's query builder from plain HTML elements and Tailwind classes, no component
// library. It's the smallest complete kit, so read it as the recipe: every control below is a few
// lines of markup, and ../shared/builder.tsx turns @trawlnet/react's hooks into the builder around
// them. Swap any element for your design system's component. MIT licensed.
'use client';

import { CopyIcon, FolderPlusIcon, GripVerticalIcon, ListTreeIcon, LockIcon, LockOpenIcon, PlusIcon, SquareFunctionIcon, TypeIcon, VariableIcon, XIcon } from 'lucide-react';
import { useId, useRef, useState, type ReactNode } from 'react';
import { createQueryBuilder } from '../shared/builder';
import { useNumberDraft } from '../shared/draft';
import type { Item, Kit, Width } from '../shared/kit';

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');
const WIDTH: Record<Width, string> = { auto: 'w-auto', full: 'w-full', xs: 'w-24', sm: 'w-36', md: 'w-44', lg: 'w-64' };

// One look for every field: a bordered, rounded box that turns red when invalid.
const field = (invalid?: boolean) =>
  cx(
    'h-8 rounded-md border bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:opacity-50',
    invalid ? 'border-red-500' : 'border-input',
  );

/** A `<details>` dropdown: native open/close and keyboard support, no positioning library. */
function Dropdown({ summary, children, className }: { summary: ReactNode; children: (close: () => void) => ReactNode; className?: string }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = () => ref.current?.removeAttribute('open');
  return (
    <details ref={ref} className={cx('group relative', className)} onBlur={(e) => !e.currentTarget.contains(e.relatedTarget as Node) && close()}>
      <summary className="list-none [&::-webkit-details-marker]:hidden">{summary}</summary>
      <div className="absolute z-50 mt-1 max-h-64 min-w-48 overflow-auto rounded-md border bg-popover p-1 text-popover-foreground text-sm shadow-md">{children(close)}</div>
    </details>
  );
}

const chip = (label: string, key: string) => (
  <span key={key} className="rounded bg-muted px-1.5 py-0.5 text-xs">
    {label}
  </span>
);

const kit: Kit = {
  name: 'headless',
  Provider: ({ children }) => <>{children}</>,

  // Native <select>, with <optgroup> for struct fields and indentation for tree options.
  Select: ({ items, value, onChange, disabled, invalid, placeholder, width, mono, label }) => {
    const groups = new Map<string | undefined, Item[]>();
    for (const i of items) groups.set(i.group, [...(groups.get(i.group) ?? []), i]);
    const option = (i: Item) => (
      <option key={i.value} value={i.value} disabled={i.disabled}>
        {'  '.repeat(i.depth ?? 0) + i.label}
      </option>
    );
    return (
      <select aria-label={label} className={cx(field(invalid), WIDTH[width ?? 'auto'], mono && 'font-mono text-xs')} value={value ?? ''} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
        {value === null && <option value="">{placeholder}</option>}
        {[...groups].map(([group, opts]) =>
          group === undefined ? (
            opts.map(option)
          ) : (
            <optgroup key={group} label={group}>
              {opts.map(option)}
            </optgroup>
          ),
        )}
      </select>
    );
  },

  TextInput: ({ value, onChange, type = 'text', disabled, invalid, placeholder, width, label }) => (
    <input type={type} aria-label={label ?? placeholder} className={cx(field(invalid), WIDTH[width ?? 'md'])} value={value} placeholder={placeholder} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
  ),

  Textarea: ({ value, onChange, disabled, invalid, placeholder, width }) => (
    <textarea rows={2} className={cx(field(invalid), 'h-auto py-1', WIDTH[width ?? 'lg'])} value={value} placeholder={placeholder} disabled={disabled} onChange={(e) => onChange(e.target.value)} />
  ),

  NumberInput({ value, onChange, min, max, step, disabled, invalid, placeholder, width, prefix, suffix, label }) {
    const { draft, onDraftChange } = useNumberDraft(value, onChange);
    return (
      <span className="inline-flex items-center gap-1 text-sm">
        {prefix && <span className="text-muted-foreground">{prefix}</span>}
        <input type="number" aria-label={label} className={cx(field(invalid), WIDTH[width ?? 'sm'])} value={draft} min={min} max={max} step={step} placeholder={placeholder} disabled={disabled} onChange={(e) => onDraftChange(e.target.value)} />
        {suffix && <span className="text-muted-foreground">{suffix}</span>}
      </span>
    );
  },

  Slider: ({ value, min, max, step, onChange, disabled, label }) => (
    <span className="inline-flex w-56 items-center gap-3">
      <input type="range" aria-label={label} className="flex-1 accent-primary" value={value} min={min} max={max} step={step} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} />
      <span className="w-8 text-end text-sm tabular-nums">{value}</span>
    </span>
  ),

  Switch: ({ checked, onChange, disabled, label }) => (
    <label className="inline-flex h-8 items-center gap-2 text-sm">
      <input type="checkbox" role="switch" className="size-4 accent-primary" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  ),

  // A dropdown of checkboxes; the summary shows the chosen values as chips.
  MultiSelect: ({ items, value, onChange, disabled, invalid, placeholder, width }) => (
    <Dropdown
      className={WIDTH[width ?? 'lg']}
      summary={
        <span aria-disabled={disabled} className={cx(field(invalid), 'flex h-auto min-h-8 cursor-pointer flex-wrap items-center gap-1 py-1', disabled && 'pointer-events-none opacity-50')}>
          {value.length ? items.filter((i) => value.includes(i.value)).map((i) => chip(i.label, i.value)) : <span className="text-muted-foreground">{placeholder}</span>}
        </span>
      }
    >
      {() =>
        items.map((i) => (
          <label key={i.value} className={cx('flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-accent', i.disabled && 'pointer-events-none opacity-60')} style={{ paddingInlineStart: `${0.5 + (i.depth ?? 0) * 0.9}rem` }}>
            <input type="checkbox" className="accent-primary" disabled={i.disabled} checked={value.includes(i.value)} onChange={(e) => onChange(e.target.checked ? [...value, i.value] : value.filter((v) => v !== i.value))} />
            {i.label}
          </label>
        ))
      }
    </Dropdown>
  ),

  // Text input + <datalist>: the browser shows the server's matches as suggestions.
  AsyncSelect({ multiple, items, loading, onQueryChange, value, onChange, disabled, invalid, placeholder, width, allowCustom }) {
    const list = useId();
    const [text, setText] = useState(multiple ? '' : (value[0]?.label ?? ''));
    const commit = (raw: string) => {
      const hit = items.find((i) => i.label.toLowerCase() === raw.toLowerCase() || i.value === raw);
      const next = hit ?? (allowCustom && raw ? { value: raw, label: raw, raw } : null);
      if (multiple) {
        if (next && !value.some((v) => v.value === next.value)) onChange([...value, next]);
        setText('');
      } else onChange(next ? [next] : []);
    };
    return (
      <span className={cx('inline-flex flex-wrap items-center gap-1', WIDTH[width ?? 'lg'])}>
        {multiple &&
          value.map((v) => (
            <button key={v.value} type="button" className="rounded bg-muted px-1.5 py-0.5 text-xs" disabled={disabled} onClick={() => onChange(value.filter((x) => x.value !== v.value))}>
              {v.label} ×
            </button>
          ))}
        <input
          list={list}
          className={cx(field(invalid), 'min-w-32 flex-1')}
          value={text}
          placeholder={loading ? 'Searching…' : placeholder}
          disabled={disabled}
          onChange={(e) => {
            setText(e.target.value);
            onQueryChange(e.target.value);
            if (!multiple && items.some((i) => i.label === e.target.value)) commit(e.target.value);
          }}
          onKeyDown={(e) => e.key === 'Enter' && commit(text)}
          onBlur={() => !multiple && commit(text)}
        />
        <datalist id={list}>
          {items.map((i) => (
            <option key={i.value} value={i.label} />
          ))}
        </datalist>
      </span>
    );
  },

  Button: ({ children, icon, onClick, disabled, variant = 'outline' }) => (
    <button
      type="button"
      className={cx('inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm [&_svg]:size-4 disabled:opacity-50', variant === 'outline' ? 'border bg-background hover:bg-accent' : 'hover:bg-accent')}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  ),

  IconButton: ({ label, icon, onClick, disabled, pressed }) => (
    <button type="button" aria-label={label} aria-pressed={pressed} className={cx('inline-flex size-8 items-center justify-center rounded-md hover:bg-accent [&_svg]:size-4 disabled:opacity-50', pressed && 'text-amber-600')} disabled={disabled} onClick={onClick}>
      {icon}
    </button>
  ),

  Toggle: ({ pressed, onChange, disabled, label, children }) => (
    <button type="button" aria-label={label} aria-pressed={pressed} className={cx('inline-flex h-8 items-center rounded-md border px-2 text-sm [&_svg]:size-4 disabled:opacity-50', pressed ? 'border-amber-500 bg-amber-500/10' : 'bg-background hover:bg-accent')} disabled={disabled} onClick={() => onChange(!pressed)}>
      {children}
    </button>
  ),

  // A radio group drawn as joined buttons.
  Segmented: ({ items, value, onChange, disabled, label }) => (
    <span role="radiogroup" aria-label={label} className="inline-flex overflow-hidden rounded-md border">
      {items.map((i) => (
        <button
          key={i.value}
          type="button"
          role="radio"
          aria-checked={value === i.value}
          aria-label={i.ariaLabel}
          title={i.tooltip}
          data-source={i.value}
          disabled={disabled}
          className={cx('inline-flex h-8 items-center px-2.5 text-sm [&_svg]:size-4 disabled:opacity-50', value === i.value ? 'bg-primary text-primary-foreground' : 'bg-background hover:bg-accent')}
          onClick={() => onChange(i.value)}
        >
          {i.label}
        </button>
      ))}
    </span>
  ),

  // The browser's own tooltip.
  Tooltip: ({ label, children }) => (
    <span className="inline-flex" title={label}>
      {children}
    </span>
  ),

  Badge: ({ children }) => <span className="rounded-md bg-primary/10 px-1.5 py-0.5 font-medium text-primary text-xs">{children}</span>,

  Menu: ({ trigger, heading, items, value, onSelect, disabled }) => (
    <Dropdown
      summary={
        <span aria-label={trigger.label} aria-disabled={disabled} title={trigger.tooltip} className={cx('inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md px-2 text-sm hover:bg-accent [&_svg]:size-4', disabled && 'pointer-events-none opacity-50')}>
          {trigger.icon}
          {!trigger.iconOnly && trigger.label}
        </span>
      }
    >
      {(close) => (
        <>
          {heading && <p className="px-2 py-1 font-medium text-muted-foreground text-xs">{heading}</p>}
          {items.map((i) => (
            <button
              key={i.value}
              type="button"
              className={cx('block w-full rounded px-2 py-1 text-start hover:bg-accent', value === i.value && 'font-medium')}
              onClick={() => {
                onSelect(i.value);
                close();
              }}
            >
              {i.label}
            </button>
          ))}
        </>
      )}
    </Dropdown>
  ),

  Surface: ({ kind, depth, negated, locked, dragging, drop, className, children, ...rest }) => (
    <div
      {...rest}
      className={cx(
        'flex flex-col gap-3 rounded-lg border p-3 text-sm',
        depth % 2 === 0 ? 'bg-muted/40' : 'bg-background',
        kind === 'array' && 'border-primary/40',
        negated && 'border-dashed border-amber-500/70',
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

  Empty: ({ children }) => <p className="rounded-md border border-dashed py-3 text-center text-muted-foreground">{children}</p>,
  ErrorText: ({ children }) => <p className="ps-6 text-red-600 text-xs dark:text-red-400">{children}</p>,
  Muted: ({ children, mono }) => <span className={cx('text-muted-foreground', mono && 'font-mono')}>{children}</span>,
  FunctionFrame: ({ children, fn }) => (
    <span className="inline-flex flex-wrap items-center gap-1 rounded-md border border-dashed p-0.5 pe-2" data-function={fn}>
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

/** The trawlnet query builder in plain HTML + Tailwind. Same props as the coss builder. */
export const QueryBuilder = createQueryBuilder(kit);

/** The kit's primitives, for building variants or tests. */
export { kit as headlessKit };
