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
