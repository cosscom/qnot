// The per-builder Scope rows share, resolved once per (controller, UI) instead of per row: each
// component that reads context copies its parent's context map, so rows created by their group
// (rows.ts) never touch context at all.
import type { DndController } from '@qnot/core';
import Group from './Group.svelte';
import Rule from './Rule.svelte';
import ValueEditor from './ValueEditor.svelte';
import { functionChoices, getDndController, getQueryStore } from './reactive';
import type { Scope } from './rows';
import { getUI, type UI } from './ui';

const scopes = new WeakMap<DndController, WeakMap<UI, Scope>>();

export function getScope(): Scope {
  const store = getQueryStore();
  const dnd = getDndController();
  const ui = getUI();
  let byUI = scopes.get(dnd);
  if (!byUI) scopes.set(dnd, (byUI = new WeakMap()));
  let scope = byUI.get(ui);
  if (!scope) {
    const { components } = ui;
    byUI.set(
      ui,
      (scope = {
        store,
        dnd,
        ui,
        inline: components.Rule === Rule && components.Group === Group,
        inlineValues: components.ValueEditor === ValueEditor,
        functions: functionChoices(store.fields).length > 0,
      }),
    );
  }
  return scope;
}
