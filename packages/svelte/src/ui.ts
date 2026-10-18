import type { AnyFieldDef, EditorSpec, NodeId, Option } from '@trawlnet/core';
import { getContext, setContext, type Component } from 'svelte';

export const DEFAULT_LABELS = {
  and: 'AND',
  or: 'OR',
  not: 'NOT',
  addRule: '+ Rule',
  addGroup: '+ Group',
  remove: 'Remove',
  clone: 'Duplicate',
  drag: 'Drag to move',
  compareField: 'Compare with another field',
  compareValue: 'Compare with a value',
  yes: 'Yes',
  no: 'No',
  empty: '—',
  rangeSeparator: 'and',
};
export type Labels = typeof DEFAULT_LABELS;

export interface ValueEditorProps {
  editor: EditorSpec;
  def: AnyFieldDef | undefined;
  value: unknown;
  onChange: (value: unknown) => void;
  invalid: boolean;
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
  fieldOptions: Option[];
}

const KEY = Symbol('trawlnet-ui');
export const setUI = (ui: UI) => setContext(KEY, ui);
export const getUI = () => getContext<UI>(KEY);

export const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');
