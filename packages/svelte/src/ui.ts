import { DEFAULT_LABELS, functionOf, type AnyFieldDef, type EditorSpec, type Fields, type FnCall, type NodeId, type Option } from '@trawlnet/core';
import { getContext, setContext, type Component } from 'svelte';

export { DEFAULT_LABELS };
export type Labels = typeof DEFAULT_LABELS;

export interface ValueEditorProps {
  editor: EditorSpec;
  def: AnyFieldDef | undefined;
  value: unknown;
  onChange: (value: unknown) => void;
  invalid: boolean;
  disabled?: boolean;
  labels: Labels;
}

export interface Components {
  Group: Component<{ id: NodeId }>;
  Rule: Component<{ id: NodeId }>;
  ValueEditor: Component<ValueEditorProps>;
}

export interface UI {
  labels: Labels;
  components: Components;
  showNot: boolean;
  showLock: boolean;
}

const KEY = Symbol('trawlnet-ui');
export const setUI = (ui: UI) => setContext(KEY, ui);
export const getUI = () => getContext<UI>(KEY);

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

/** A function call with each argument at its default literal. */
export const defaultCall = (fields: Fields, fn: string): FnCall => {
  const def = functionOf(fields, { fn, args: {} });
  return { fn, args: Object.fromEntries(Object.entries(def?.args ?? {}).map(([name, a]) => [name, { value: a.defaultValue ?? null }])) };
};

export const COUNT_OPS: Option[] = [
  { value: 'gte', label: 'at least' },
  { value: 'lte', label: 'at most' },
  { value: 'eq', label: 'exactly' },
  { value: 'gt', label: 'more than' },
  { value: 'lt', label: 'fewer than' },
];

export const indent = (depth: number | undefined) => '  '.repeat(depth ?? 0);
