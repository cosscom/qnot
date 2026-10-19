import { DEFAULT_LABELS, defaultCall, type AnyFieldDef, type EditorSpec, type NodeId } from '@qnot/core';
import { getContext, setContext, type Component } from 'svelte';

export { DEFAULT_LABELS, defaultCall };
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

const KEY = Symbol('qnot-ui');
export const setUI = (ui: UI) => setContext(KEY, ui);
export const getUI = () => getContext<UI>(KEY);

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

export const indent = (depth: number | undefined) => '  '.repeat(depth ?? 0);

const sources = new WeakMap<Labels, { value: string; label: string }[][]>();
/** "Compare with" choices (value, + field, + function), shared per labels object. */
export function sourceOptions(labels: Labels, refs: boolean, fns: boolean): { value: string; label: string }[] {
  let lists = sources.get(labels);
  if (!lists) sources.set(labels, (lists = []));
  const i = (refs ? 1 : 0) | (fns ? 2 : 0);
  return (lists[i] ??= [
    { value: 'value', label: labels.compareValue },
    ...(refs ? [{ value: 'field', label: labels.compareField }] : []),
    ...(fns ? [{ value: 'function', label: labels.compareFunction }] : []),
  ]);
}

/** Whether any issue is an error (the row's invalid state). */
export const hasError = (issues: readonly { severity: string }[]) => issues.length > 0 && issues.some((i) => i.severity === 'error');
