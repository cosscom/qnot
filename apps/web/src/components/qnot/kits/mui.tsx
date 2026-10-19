// Part of qnot (https://github.com/cosscom/qnot). MIT licensed; installable with shadcn.
// qnot's query builder in Material UI: TextField, Select, Autocomplete, ToggleButtonGroup and
// Paper, themed to follow the page's light/dark mode, on @qnot/react's headless hooks. MIT licensed.
'use client';

import AccountTreeOutlined from '@mui/icons-material/AccountTreeOutlined';
import Add from '@mui/icons-material/Add';
import Close from '@mui/icons-material/Close';
import ContentCopy from '@mui/icons-material/ContentCopy';
import CreateNewFolderOutlined from '@mui/icons-material/CreateNewFolderOutlined';
import DragIndicator from '@mui/icons-material/DragIndicator';
import Functions from '@mui/icons-material/Functions';
import Lock from '@mui/icons-material/Lock';
import LockOpen from '@mui/icons-material/LockOpen';
import TextFields from '@mui/icons-material/TextFields';
import ViewColumnOutlined from '@mui/icons-material/ViewColumnOutlined';
import Autocomplete from '@mui/material/Autocomplete';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import ListSubheader from '@mui/material/ListSubheader';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import Slider from '@mui/material/Slider';
import { createTheme, ThemeProvider, type Theme } from '@mui/material/styles';
import Switch from '@mui/material/Switch';
import TextField from '@mui/material/TextField';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useMemo, useState, useSyncExternalStore, type ComponentProps, type ReactNode } from 'react';
import { createQueryBuilder } from '@/components/qnot/kits/shared/builder';
import { useNumberDraft } from '@/components/qnot/kits/shared/draft';
import type { Item, Kit, Width } from '@/components/qnot/kits/shared/kit';

const WIDTH: Record<Width, string | number> = { auto: 'auto', full: '100%', xs: 104, sm: 152, md: 184, lg: 264 };
const width = (w: Width | undefined, fallback: Width) => ({ width: WIDTH[w ?? fallback], minWidth: w === 'auto' || (!w && fallback === 'auto') ? 120 : undefined });

/** Follows the page's `.dark` class (next-themes / the site's toggle). */
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

const themes = new Map<boolean, Theme>();
const themeFor = (dark: boolean) => {
  let t = themes.get(dark);
  if (!t) {
    t = createTheme({
      palette: { mode: dark ? 'dark' : 'light', ...(dark && { background: { paper: '#1c1c1f', default: '#141416' } }) },
      shape: { borderRadius: 8 },
      typography: { fontFamily: 'inherit', fontSize: 13 },
      components: {
        MuiButton: { defaultProps: { size: 'small', disableElevation: true }, styleOverrides: { root: { textTransform: 'none' } } },
        MuiToggleButton: { styleOverrides: { root: { textTransform: 'none', paddingBlock: 3, paddingInline: 10 } } },
        MuiTooltip: { defaultProps: { arrow: true, enterDelay: 300 } },
      },
    });
    themes.set(dark, t);
  }
  return t;
};

const groupOf = (items: readonly Item[]) => {
  const out = new Map<string | undefined, Item[]>();
  for (const i of items) out.set(i.group, [...(out.get(i.group) ?? []), i]);
  return [...out];
};

function MenuButton({ trigger, heading, items, value, onSelect, disabled }: ComponentProps<Kit['Menu']>) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);
  return (
    <>
      {trigger.iconOnly ? (
        <IconButton size="small" aria-label={trigger.label} disabled={disabled} onClick={(e) => setAnchor(e.currentTarget)} sx={{ p: 0.5 }}>
          {trigger.icon}
        </IconButton>
      ) : (
        <Button variant="text" startIcon={trigger.icon} disabled={disabled} onClick={(e) => setAnchor(e.currentTarget)}>
          {trigger.label}
        </Button>
      )}
      <Menu anchorEl={anchor} open={!!anchor} onClose={() => setAnchor(null)} slotProps={{ list: { dense: true } }}>
        {heading && <ListSubheader sx={{ lineHeight: '32px' }}>{heading}</ListSubheader>}
        {items.map((i) => (
          <MenuItem
            key={i.value}
            selected={value === i.value}
            onClick={() => {
              onSelect(i.value);
              setAnchor(null);
            }}
          >
            {i.label}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

const kit: Kit = {
  name: 'mui',
  Provider({ children }) {
    const dark = useDarkClass();
    return <ThemeProvider theme={themeFor(dark)}>{children}</ThemeProvider>;
  },

  Select({ items, value, onChange, disabled, invalid, placeholder, width: w, mono, label }) {
    const options: ReactNode[] = [];
    for (const [group, opts] of groupOf(items)) {
      if (group !== undefined) options.push(<ListSubheader key={`g:${group}`}>{group}</ListSubheader>);
      for (const i of opts)
        options.push(
          <MenuItem key={i.value} value={i.value} disabled={i.disabled} sx={{ pl: 2 + (i.depth ?? 0) * 1.5, fontFamily: mono ? 'ui-monospace, monospace' : undefined, fontSize: mono ? 12 : undefined }}>
            {i.label}
          </MenuItem>,
        );
    }
    return (
      <TextField
        select
        size="small"
        value={value ?? ''}
        error={invalid}
        disabled={disabled}
        sx={width(w, 'auto')}
        slotProps={{
          htmlInput: { 'aria-label': label },
          select: {
            displayEmpty: true,
            renderValue: (v) => (v === '' ? <span style={{ opacity: 0.6 }}>{placeholder}</span> : (items.find((i) => i.value === v)?.label ?? String(v))),
            MenuProps: { slotProps: { list: { dense: true } } },
            sx: mono ? { fontFamily: 'ui-monospace, monospace', fontSize: 12 } : undefined,
          },
        }}
        onChange={(e) => onChange(e.target.value)}
      >
        {options}
      </TextField>
    );
  },

  TextInput: ({ value, onChange, type = 'text', disabled, invalid, placeholder, width: w, label }) => (
    <TextField
      size="small"
      type={type}
      value={value}
      placeholder={placeholder}
      error={invalid}
      disabled={disabled}
      sx={width(w, 'md')}
      slotProps={{ htmlInput: { 'aria-label': label ?? placeholder } }}
      onChange={(e) => onChange(e.target.value)}
    />
  ),

  Textarea: ({ value, onChange, disabled, invalid, placeholder, width: w }) => (
    <TextField size="small" multiline minRows={2} value={value} placeholder={placeholder} error={invalid} disabled={disabled} sx={width(w, 'lg')} onChange={(e) => onChange(e.target.value)} />
  ),

  NumberInput({ value, onChange, min, max, step, disabled, invalid, placeholder, width: w, prefix, suffix, label }) {
    const { draft, onDraftChange } = useNumberDraft(value, onChange);
    return (
      <TextField
        size="small"
        type="number"
        value={draft}
        placeholder={placeholder}
        error={invalid}
        disabled={disabled}
        sx={width(w, 'sm')}
        slotProps={{
          htmlInput: { min, max, step, 'aria-label': label },
          input: {
            startAdornment: prefix ? <InputAdornment position="start">{prefix}</InputAdornment> : undefined,
            endAdornment: suffix ? <InputAdornment position="end">{suffix}</InputAdornment> : undefined,
          },
        }}
        onChange={(e) => onDraftChange(e.target.value)}
      />
    );
  },

  Slider: ({ value, min, max, step, onChange, disabled, label }) => (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 14, width: 240, paddingInline: 6 }}>
      <Slider size="small" value={value} min={min} max={max} step={step} disabled={disabled} aria-label={label} valueLabelDisplay="auto" onChange={(_, v) => onChange(v as number)} />
      <Typography variant="body2" sx={{ width: 32, textAlign: 'end', fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </Typography>
    </span>
  ),

  Switch: ({ checked, onChange, disabled, label }) => (
    <FormControlLabel sx={{ m: 0, gap: 0.5 }} control={<Switch size="small" checked={checked} disabled={disabled} onChange={(_, c) => onChange(c)} />} label={<Typography variant="body2">{label}</Typography>} />
  ),

  MultiSelect({ items, value, onChange, disabled, invalid, placeholder, width: w }) {
    const selected = useMemo(() => items.filter((i) => value.includes(i.value)), [items, value]);
    return (
      <Autocomplete
        multiple
        size="small"
        disableCloseOnSelect
        options={items as Item[]}
        value={selected}
        disabled={disabled}
        groupBy={items.some((i) => i.group) ? (i) => i.group ?? '' : undefined}
        getOptionLabel={(i) => i.label}
        getOptionDisabled={(i) => !!i.disabled}
        isOptionEqualToValue={(a, b) => a.value === b.value}
        renderOption={(props, i) => {
          const { key, ...rest } = props as typeof props & { key: string };
          return (
            <li key={key} {...rest} style={{ ...rest.style, paddingLeft: 16 + (i.depth ?? 0) * 14 }}>
              {i.label}
            </li>
          );
        }}
        onChange={(_, next) => onChange(next.map((i) => i.value))}
        sx={width(w, 'lg')}
        renderInput={(params) => <TextField {...params} error={invalid} placeholder={selected.length ? undefined : placeholder} />}
      />
    );
  },

  AsyncSelect({ multiple, items, loading, onQueryChange, value, onChange, disabled, invalid, placeholder, width: w, allowCustom }) {
    const common = {
      size: 'small' as const,
      options: items as Item[],
      loading,
      disabled,
      freeSolo: !!allowCustom,
      filterOptions: (x: Item[]) => x,
      getOptionLabel: (i: Item | string) => (typeof i === 'string' ? i : i.label),
      isOptionEqualToValue: (a: Item, b: Item | string) => a.value === (typeof b === 'string' ? b : b.value),
      onInputChange: (_: unknown, q: string, reason: string) => reason !== 'reset' && onQueryChange(q),
      sx: width(w, 'lg'),
      renderInput: (params: object) => (
        <TextField
          {...params}
          error={invalid}
          placeholder={placeholder}
          slotProps={{
            input: {
              ...(params as { InputProps?: object }).InputProps,
              endAdornment: (
                <>
                  {loading && <CircularProgress color="inherit" size={14} />}
                  {(params as { InputProps?: { endAdornment?: ReactNode } }).InputProps?.endAdornment}
                </>
              ),
            },
          }}
        />
      ),
    };
    const asItem = (v: Item | string): Item => (typeof v === 'string' ? { value: v, label: v, raw: v } : v);
    return multiple ? (
      <Autocomplete {...common} multiple disableCloseOnSelect value={value as Item[]} onChange={(_: unknown, next: (Item | string)[]) => onChange(next.map(asItem))} />
    ) : (
      <Autocomplete {...common} value={value[0] ?? null} onChange={(_: unknown, next: Item | string | null) => onChange(next ? [asItem(next)] : [])} />
    );
  },

  Button: ({ children, icon, onClick, disabled, variant = 'outline' }) => (
    <Button variant={variant === 'outline' ? 'outlined' : 'text'} startIcon={icon} disabled={disabled} onClick={onClick}>
      {children}
    </Button>
  ),

  IconButton: ({ label, icon, onClick, disabled, pressed }) => (
    <IconButton size="small" aria-label={label} aria-pressed={pressed} color={pressed ? 'warning' : 'default'} disabled={disabled} onClick={onClick}>
      {icon}
    </IconButton>
  ),

  Toggle: ({ pressed, onChange, disabled, label, children }) => (
    <ToggleButton size="small" value="on" aria-label={label} selected={pressed} disabled={disabled} color={pressed ? 'warning' : 'standard'} onChange={() => onChange(!pressed)}>
      {children}
    </ToggleButton>
  ),

  Segmented: ({ items, value, onChange, disabled, label, compact }) => (
    <ToggleButtonGroup size="small" exclusive color="primary" aria-label={label} value={value} disabled={disabled} onChange={(_, v) => v && onChange(v)}>
      {items.map((i) => (
        <Tooltip key={i.value} title={i.tooltip ?? ''} disableHoverListener={!i.tooltip}>
          <ToggleButton value={i.value} aria-label={i.ariaLabel} data-source={i.value} sx={compact ? { px: 0.75, '& svg': { fontSize: 18 } } : undefined}>
            {i.label}
          </ToggleButton>
        </Tooltip>
      ))}
    </ToggleButtonGroup>
  ),

  Tooltip: ({ label, children }) => (
    <Tooltip title={label}>
      <span style={{ display: 'inline-flex' }}>{children}</span>
    </Tooltip>
  ),

  Badge: ({ children }) => <Chip size="small" color="primary" variant="outlined" label={children} />,

  Menu: MenuButton,

  Surface: ({ kind, depth, negated, locked, dragging, drop, style, children, ...rest }) => (
    <Paper
      {...rest}
      variant="outlined"
      style={style}
      sx={{
        display: 'flex',
        flexDirection: 'column',
        gap: 1.5,
        p: 1.5,
        borderRadius: 3,
        bgcolor: depth % 2 === 0 ? 'action.hover' : 'background.paper',
        borderColor: negated ? 'warning.main' : kind === 'array' ? 'primary.light' : undefined,
        borderStyle: negated ? 'dashed' : 'solid',
        opacity: dragging ? 0.4 : locked ? 0.8 : 1,
        boxShadow: drop === 'before' ? (t) => `0 -2px 0 ${t.palette.primary.main}` : drop === 'after' ? (t) => `0 2px 0 ${t.palette.primary.main}` : 'none',
        color: 'text.primary',
      }}
    >
      {children}
    </Paper>
  ),

  Empty: ({ children }) => (
    <Typography variant="body2" color="text.secondary" sx={{ border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 2, py: 2, textAlign: 'center' }}>
      {children}
    </Typography>
  ),
  ErrorText: ({ children }) => (
    <Typography variant="caption" color="error" sx={{ pl: 3.5 }}>
      {children}
    </Typography>
  ),
  Muted: ({ children, mono }) => (
    <Typography variant="body2" color="text.secondary" component="span" sx={mono ? { fontFamily: 'ui-monospace, monospace' } : undefined}>
      {children}
    </Typography>
  ),
  FunctionFrame: ({ children, fn }) => (
    <Paper variant="outlined" data-function={fn} sx={{ display: 'inline-flex', flexWrap: 'wrap', alignItems: 'center', gap: 0.5, p: 0.5, pr: 1, borderStyle: 'dashed', bgcolor: 'action.hover' }}>
      {children}
    </Paper>
  ),

  icons: {
    grip: <DragIndicator fontSize="small" />,
    plus: <Add />,
    folderPlus: <CreateNewFolderOutlined />,
    list: <AccountTreeOutlined />,
    copy: <ContentCopy fontSize="small" />,
    remove: <Close fontSize="small" />,
    lock: <Lock fontSize="small" />,
    unlock: <LockOpen fontSize="small" />,
    fn: <Functions fontSize="small" />,
    value: <TextFields fontSize="small" />,
    field: <ViewColumnOutlined fontSize="small" />,
  },
};

/** The qnot query builder in Material UI. Same props as the coss builder. */
export const QueryBuilder = createQueryBuilder(kit);

/** The kit's primitives, for building variants or tests. */
export { kit as muiKit };
