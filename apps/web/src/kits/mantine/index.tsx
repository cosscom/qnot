// trawlnet's query builder in Mantine: Select/MultiSelect with groups and server search,
// NumberInput, SegmentedControl, Menu and Paper, following the page's light/dark mode, on
// @trawlnet/react's headless hooks. Only Mantine's component styles are imported (layered, no
// baseline), so the rest of the page keeps its own styles. MIT licensed.
'use client';

import '@mantine/core/styles/default-css-variables.layer.css';
import '@mantine/core/styles/global.layer.css';
import '@mantine/core/styles/UnstyledButton.layer.css';
import '@mantine/core/styles/VisuallyHidden.layer.css';
import '@mantine/core/styles/Paper.layer.css';
import '@mantine/core/styles/Popover.layer.css';
import '@mantine/core/styles/CloseButton.layer.css';
import '@mantine/core/styles/Group.layer.css';
import '@mantine/core/styles/Loader.layer.css';
import '@mantine/core/styles/Overlay.layer.css';
import '@mantine/core/styles/ScrollArea.layer.css';
import '@mantine/core/styles/Text.layer.css';
import '@mantine/core/styles/Divider.layer.css';
import '@mantine/core/styles/Input.layer.css';
import '@mantine/core/styles/InlineInput.layer.css';
import '@mantine/core/styles/Combobox.layer.css';
import '@mantine/core/styles/Pill.layer.css';
import '@mantine/core/styles/PillsInput.layer.css';
import '@mantine/core/styles/Checkbox.layer.css';
import '@mantine/core/styles/NumberInput.layer.css';
import '@mantine/core/styles/Button.layer.css';
import '@mantine/core/styles/ActionIcon.layer.css';
import '@mantine/core/styles/Badge.layer.css';
import '@mantine/core/styles/Tooltip.layer.css';
import '@mantine/core/styles/Menu.layer.css';
import '@mantine/core/styles/Slider.layer.css';
import '@mantine/core/styles/Switch.layer.css';
import '@mantine/core/styles/FloatingIndicator.layer.css';
import '@mantine/core/styles/SegmentedControl.layer.css';
import {
  ActionIcon,
  Badge,
  Button,
  createTheme,
  Loader,
  MantineProvider,
  Menu,
  MultiSelect,
  NumberInput,
  Paper,
  SegmentedControl,
  Select,
  Slider,
  Switch,
  Text,
  Textarea,
  TextInput,
  Tooltip,
  type ComboboxData,
  type ComboboxItem,
} from '@mantine/core';
import { CopyIcon, FolderPlusIcon, GripVerticalIcon, ListTreeIcon, LockIcon, LockOpenIcon, PlusIcon, SquareFunctionIcon, TypeIcon, VariableIcon, XIcon } from 'lucide-react';
import { useMemo, useState, useSyncExternalStore } from 'react';
import { createQueryBuilder } from '../shared/builder';
import type { Item, Kit, Width } from '../shared/kit';

const WIDTH: Record<Width, string | number | undefined> = { auto: undefined, full: '100%', xs: 104, sm: 152, md: 184, lg: 264 };
const w = (width: Width | undefined, fallback: Width) => ({ width: WIDTH[width ?? fallback], minWidth: (width ?? fallback) === 'auto' ? 132 : undefined });

function useDarkClass(): boolean {
  return useSyncExternalStore(
    (fn) => {
      const mo = new MutationObserver(fn);
      mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
      return () => mo.disconnect();
    },
    () => document.documentElement.classList.contains('dark'),
    () => false,
  );
}

const theme = createTheme({ fontFamily: 'inherit', primaryColor: 'blue', defaultRadius: 'md', components: { Tooltip: { defaultProps: { withArrow: true, openDelay: 300 } } } });

/** Mantine's grouped option data, keeping each item's tree depth for indentation. */
function toData(items: readonly Item[]): { data: ComboboxData; depth: Map<string, number> } {
  const depth = new Map<string, number>();
  const groups = new Map<string | undefined, ComboboxItem[]>();
  for (const i of items) {
    if (i.depth) depth.set(i.value, i.depth);
    groups.set(i.group, [...(groups.get(i.group) ?? []), { value: i.value, label: i.label, disabled: i.disabled }]);
  }
  const data: ComboboxData = [...groups].flatMap<ComboboxItem | { group: string; items: ComboboxItem[] }>(([group, opts]) => (group === undefined ? opts : [{ group, items: opts }]));
  return { data, depth };
}

const indentOption = (depth: Map<string, number>) => ({ option }: { option: ComboboxItem }) => <span style={{ paddingInlineStart: (depth.get(option.value) ?? 0) * 14 }}>{option.label}</span>;

/** Server-searched options plus the current selection (so it always has a label) and a custom entry. */
function asyncData(items: readonly Item[], value: readonly Item[], query: string, allowCustom?: boolean): ComboboxItem[] {
  const out = new Map<string, ComboboxItem>();
  for (const i of [...value, ...items]) out.set(i.value, { value: i.value, label: i.label });
  if (allowCustom && query && ![...out.values()].some((o) => o.label.toLowerCase() === query.toLowerCase())) out.set(query, { value: query, label: query });
  return [...out.values()];
}

const kit: Kit = {
  name: 'mantine',
  Provider({ children }) {
    const dark = useDarkClass();
    return (
      <MantineProvider theme={theme} forceColorScheme={dark ? 'dark' : 'light'}>
        {children}
      </MantineProvider>
    );
  },

  Select({ items, value, onChange, disabled, invalid, placeholder, width, mono, label }) {
    const { data, depth } = useMemo(() => toData(items), [items]);
    return (
      <Select
        size="xs"
        data={data}
        value={value}
        aria-label={label}
        placeholder={placeholder}
        error={invalid}
        disabled={disabled}
        allowDeselect={false}
        checkIconPosition="right"
        renderOption={depth.size ? indentOption(depth) : undefined}
        style={w(width, 'auto')}
        styles={mono ? { input: { fontFamily: 'var(--mantine-font-family-monospace)', fontSize: 12 } } : undefined}
        comboboxProps={{ shadow: 'md' }}
        onChange={(v) => v !== null && onChange(v)}
      />
    );
  },

  TextInput: ({ value, onChange, type = 'text', disabled, invalid, placeholder, width, label }) => (
    <TextInput size="xs" type={type} value={value} aria-label={label ?? placeholder} placeholder={placeholder} error={invalid} disabled={disabled} style={w(width, 'md')} onChange={(e) => onChange(e.currentTarget.value)} />
  ),

  Textarea: ({ value, onChange, disabled, invalid, placeholder, width }) => (
    <Textarea size="xs" autosize minRows={2} value={value} placeholder={placeholder} error={invalid} disabled={disabled} style={w(width, 'lg')} onChange={(e) => onChange(e.currentTarget.value)} />
  ),

  NumberInput: ({ value, onChange, min, max, step, disabled, invalid, placeholder, width, prefix, suffix, label }) => (
    <NumberInput
      size="xs"
      value={value ?? ''}
      min={min}
      max={max}
      step={step}
      prefix={prefix && `${prefix} `}
      suffix={suffix && ` ${suffix}`}
      aria-label={label}
      placeholder={placeholder}
      error={invalid}
      disabled={disabled}
      style={w(width, 'sm')}
      onChange={(v) => onChange(v === '' ? null : typeof v === 'number' ? v : Number.isNaN(Number(v)) ? null : Number(v))}
    />
  ),

  Slider: ({ value, min, max, step, onChange, disabled, label }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 12, width: 240 }}>
      <Slider size="sm" style={{ flex: 1 }} value={value} min={min} max={max} step={step} disabled={disabled} aria-label={label} onChange={onChange} />
      <Text size="sm" fw={500} w={32} ta="end">
        {value}
      </Text>
    </span>
  ),

  Switch: ({ checked, onChange, disabled, label }) => <Switch size="sm" checked={checked} disabled={disabled} label={label} onChange={(e) => onChange(e.currentTarget.checked)} />,

  MultiSelect({ items, value, onChange, disabled, invalid, placeholder, width }) {
    const { data, depth } = useMemo(() => toData(items), [items]);
    return (
      <MultiSelect
        size="xs"
        data={data}
        value={value as string[]}
        searchable
        placeholder={value.length ? undefined : placeholder}
        error={invalid}
        disabled={disabled}
        renderOption={depth.size ? indentOption(depth) : undefined}
        style={w(width, 'lg')}
        comboboxProps={{ shadow: 'md' }}
        onChange={onChange}
      />
    );
  },

  AsyncSelect({ multiple, items, loading, onQueryChange, value, onChange, disabled, invalid, placeholder, width, allowCustom }) {
    const [query, setQuery] = useState('');
    const data = asyncData(items, value, query, allowCustom);
    const byValue = new Map(data.map((o) => [o.value, o]));
    const toItem = (v: string): Item => {
      const known = [...value, ...items].find((i) => i.value === v);
      return known ?? { value: v, label: byValue.get(v)?.label ?? v, raw: v };
    };
    const common = {
      size: 'xs' as const,
      data,
      searchable: true,
      searchValue: query,
      onSearchChange: (q: string) => {
        setQuery(q);
        onQueryChange(q);
      },
      filter: ({ options }: { options: ComboboxData }) => options as ComboboxItem[],
      nothingFoundMessage: loading ? 'Searching…' : 'No matches',
      rightSection: loading ? <Loader size={12} /> : undefined,
      error: invalid,
      disabled,
      style: w(width, 'lg'),
      comboboxProps: { shadow: 'md' },
    };
    return multiple ? (
      <MultiSelect {...common} value={value.map((i) => i.value)} placeholder={value.length ? undefined : placeholder} onChange={(vs) => onChange(vs.map(toItem))} />
    ) : (
      <Select {...common} value={value[0]?.value ?? null} placeholder={placeholder} onChange={(v) => onChange(v ? [toItem(v)] : [])} />
    );
  },

  Button: ({ children, icon, onClick, disabled, variant = 'outline' }) => (
    <Button size="xs" variant={variant === 'outline' ? 'default' : 'subtle'} color={variant === 'outline' ? undefined : 'gray'} leftSection={icon} disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  ),

  IconButton: ({ label, icon, onClick, disabled, pressed }) => (
    <ActionIcon size="md" variant={pressed ? 'light' : 'subtle'} color={pressed ? 'orange' : 'gray'} aria-label={label} aria-pressed={pressed} disabled={disabled} onClick={onClick}>
      {icon}
    </ActionIcon>
  ),

  Toggle: ({ pressed, onChange, disabled, label, children }) => (
    <Button size="xs" px={8} variant={pressed ? 'light' : 'default'} color={pressed ? 'orange' : undefined} aria-label={label} aria-pressed={pressed} disabled={disabled} onClick={() => onChange(!pressed)}>
      {children}
    </Button>
  ),

  Segmented: ({ items, value, onChange, disabled, label, compact }) => (
    <SegmentedControl
      size="xs"
      aria-label={label}
      value={value ?? ''}
      disabled={disabled}
      onChange={onChange}
      styles={compact ? { label: { paddingInline: 6, display: 'flex', alignItems: 'center' } } : undefined}
      data={items.map((i) => ({
        value: i.value,
        label: i.tooltip ? (
          <Tooltip label={i.tooltip}>
            <span aria-label={i.ariaLabel} data-source={i.value} style={{ display: 'inline-flex', alignItems: 'center' }}>
              {i.label}
            </span>
          </Tooltip>
        ) : (
          <span aria-label={i.ariaLabel} data-source={i.value}>
            {i.label}
          </span>
        ),
      }))}
    />
  ),

  Tooltip: ({ label, children }) => (
    <Tooltip label={label}>
      <span style={{ display: 'inline-flex' }}>{children}</span>
    </Tooltip>
  ),

  Badge: ({ children }) => (
    <Badge variant="light" size="sm" radius="sm" tt="none">
      {children}
    </Badge>
  ),

  Menu: ({ trigger, heading, items, value, onSelect, disabled }) => (
    <Menu shadow="md" position="bottom-start" withinPortal>
      <Menu.Target>
        {trigger.iconOnly ? (
          <ActionIcon size="sm" variant="subtle" color="gray" aria-label={trigger.label} disabled={disabled}>
            {trigger.icon}
          </ActionIcon>
        ) : (
          <Button size="xs" variant="subtle" color="gray" leftSection={trigger.icon} disabled={disabled}>
            {trigger.label}
          </Button>
        )}
      </Menu.Target>
      <Menu.Dropdown>
        {heading && <Menu.Label>{heading}</Menu.Label>}
        {items.map((i) => (
          <Menu.Item key={i.value} onClick={() => onSelect(i.value)} fw={value === i.value ? 600 : undefined}>
            {i.label}
          </Menu.Item>
        ))}
      </Menu.Dropdown>
    </Menu>
  ),

  Surface: ({ kind, depth, negated, locked, dragging, drop, style, children, ...rest }) => (
    <Paper
      {...rest}
      withBorder
      radius="md"
      p="sm"
      style={{
        ...style,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        background: depth % 2 === 0 ? 'var(--mantine-color-default-hover)' : 'var(--mantine-color-body)',
        borderColor: negated ? 'var(--mantine-color-orange-filled)' : kind === 'array' ? 'var(--mantine-color-blue-light-color)' : undefined,
        borderStyle: negated ? 'dashed' : undefined,
        opacity: dragging ? 0.4 : locked ? 0.8 : 1,
        boxShadow: drop === 'before' ? '0 -2px 0 var(--mantine-primary-color-filled)' : drop === 'after' ? '0 2px 0 var(--mantine-primary-color-filled)' : undefined,
        color: 'var(--mantine-color-text)',
        fontSize: 'var(--mantine-font-size-sm)',
      }}
    >
      {children}
    </Paper>
  ),

  Empty: ({ children }) => (
    <Text size="sm" c="dimmed" ta="center" py="sm" style={{ border: '1px dashed var(--mantine-color-default-border)', borderRadius: 'var(--mantine-radius-md)' }}>
      {children}
    </Text>
  ),
  ErrorText: ({ children }) => (
    <Text size="xs" c="red" pl={28}>
      {children}
    </Text>
  ),
  Muted: ({ children, mono }) => (
    <Text span size="sm" c="dimmed" ff={mono ? 'monospace' : undefined}>
      {children}
    </Text>
  ),
  FunctionFrame: ({ children, fn }) => (
    <Paper
      withBorder
      radius="md"
      data-function={fn}
      style={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 4, padding: '2px 8px 2px 2px', borderStyle: 'dashed', background: 'var(--mantine-color-default-hover)' }}
    >
      {children}
    </Paper>
  ),

  icons: {
    grip: <GripVerticalIcon size={16} />,
    plus: <PlusIcon size={14} />,
    folderPlus: <FolderPlusIcon size={14} />,
    list: <ListTreeIcon size={14} />,
    copy: <CopyIcon size={15} />,
    remove: <XIcon size={15} />,
    lock: <LockIcon size={15} />,
    unlock: <LockOpenIcon size={15} />,
    fn: <SquareFunctionIcon size={15} />,
    value: <TypeIcon size={14} />,
    field: <VariableIcon size={14} />,
  },
};

/** The trawlnet query builder in Mantine. Same props as the coss builder. */
export const QueryBuilder = createQueryBuilder(kit);

/** The kit's primitives, for building variants or tests. */
export { kit as mantineKit };
