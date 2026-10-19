// The contract between trawlnet's kit-agnostic query builder (./builder.tsx) and a UI kit. A kit
// supplies its own native controls; the builder supplies every behaviour (scoping, value sources,
// functions, array groups, locks, permissions, drag and drop). MIT licensed.
import type { ComponentType, HTMLAttributes, ReactElement, ReactNode } from 'react';

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

/** Preferred control width; kits map these to their own sizing. */
export type Width = 'auto' | 'full' | 'xs' | 'sm' | 'md' | 'lg';

interface Control {
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
  width?: Width;
  /** Accessible name when there is no visible label. */
  label?: string;
}

export interface SegmentItem {
  value: string;
  label: ReactNode;
  tooltip?: string;
  ariaLabel?: string;
}

export interface MenuSpec {
  label: string;
  icon?: ReactNode;
  /** Render only the icon (with the label as its accessible name). */
  iconOnly?: boolean;
  tooltip?: string;
}

export interface SurfaceProps extends Omit<HTMLAttributes<HTMLDivElement>, 'children'> {
  kind: 'root' | 'group' | 'array';
  depth: number;
  negated?: boolean;
  locked?: boolean;
  dragging?: boolean;
  /** Where a dragged node would land relative to this one. */
  drop?: 'before' | 'after' | 'inside' | null;
  children: ReactNode;
}

export interface Kit {
  name: string;
  /** Theme/context the controls need (MUI ThemeProvider, MantineProvider, tooltip providers…). */
  Provider: ComponentType<{ children: ReactNode }>;
  Select: ComponentType<Control & { items: readonly Item[]; value: string | null; onChange: (v: string) => void; mono?: boolean }>;
  TextInput: ComponentType<Control & { value: string; onChange: (v: string) => void; type?: 'text' | 'date' | 'time' | 'datetime-local' }>;
  Textarea: ComponentType<Control & { value: string; onChange: (v: string) => void }>;
  NumberInput: ComponentType<Control & { value: number | null; onChange: (v: number | null) => void; min?: number; max?: number; step?: number; prefix?: string; suffix?: string }>;
  Slider: ComponentType<{ value: number; min: number; max: number; step: number; onChange: (v: number) => void; disabled?: boolean; label?: string }>;
  Switch: ComponentType<{ checked: boolean; onChange: (checked: boolean) => void; disabled?: boolean; label?: string }>;
  MultiSelect: ComponentType<Control & { items: readonly Item[]; value: readonly string[]; onChange: (values: string[]) => void }>;
  /** Options come from a remote search; the builder runs the (debounced, abortable) query. */
  AsyncSelect: ComponentType<
    Control & {
      multiple?: boolean;
      items: readonly Item[];
      loading: boolean;
      onQueryChange: (q: string) => void;
      value: readonly Item[];
      onChange: (items: Item[]) => void;
      /** Accept free text that matches no option. */
      allowCustom?: boolean;
    }
  >;
  Button: ComponentType<{ children: ReactNode; icon?: ReactNode; onClick: () => void; disabled?: boolean; variant?: 'outline' | 'ghost' }>;
  IconButton: ComponentType<{ label: string; icon: ReactNode; onClick: () => void; disabled?: boolean; pressed?: boolean }>;
  Toggle: ComponentType<{ pressed: boolean; onChange: (pressed: boolean) => void; disabled?: boolean; label: string; children: ReactNode }>;
  Segmented: ComponentType<{ items: readonly SegmentItem[]; value: string | null; onChange: (v: string) => void; disabled?: boolean; label?: string; compact?: boolean }>;
  Tooltip: ComponentType<{ label: string; children: ReactElement }>;
  Badge: ComponentType<{ children: ReactNode }>;
  Menu: ComponentType<{ trigger: MenuSpec; heading?: string; items: readonly { value: string; label: string }[]; value?: string; onSelect: (v: string) => void; disabled?: boolean }>;
  Surface: ComponentType<SurfaceProps>;
  /** A dashed placeholder for an empty group. */
  Empty: ComponentType<{ children: ReactNode }>;
  ErrorText: ComponentType<{ children: ReactNode }>;
  /** Small connective text: "and", "of", "where", "(". */
  Muted: ComponentType<{ children: ReactNode; mono?: boolean }>;
  /** Frame around a function call, e.g. a dashed outline. */
  FunctionFrame: ComponentType<{ children: ReactNode; fn: string }>;
  icons: Record<'grip' | 'plus' | 'folderPlus' | 'list' | 'copy' | 'remove' | 'lock' | 'unlock' | 'fn' | 'value' | 'field', ReactNode>;
}
