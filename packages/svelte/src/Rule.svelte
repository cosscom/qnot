<script lang="ts">
  import { CLASS, refOptions, type NodeId } from '@trawlnet/core';
  import { createDragHandle, createDropTarget, createRule, getDndController, getQueryStore } from './reactive';
  import { cx, getUI } from './ui';

  let { id }: { id: NodeId } = $props();
  const store = getQueryStore();
  const dnd = getDndController();
  const ui = getUI();
  // svelte-ignore state_referenced_locally
  const r = createRule(store, id);
  // svelte-ignore state_referenced_locally
  const drag = createDragHandle(dnd, id);
  // svelte-ignore state_referenced_locally
  const drop = createDropTarget(store, dnd, id);

  const rule = $derived(r.rule);
  const editor = $derived(r.editor);
  const issues = $derived(r.issues);
  const invalid = $derived(issues.some((i) => i.severity === 'error'));
  const refs = $derived(editor.allowsRef ? refOptions(store.fields, rule.field) : []);
  const ValueEditor = $derived(ui.components.ValueEditor);
</script>

<div
  class={cx(CLASS.rule, invalid && CLASS.invalid, drag.isDragging && CLASS.dragging, drop.position === 'before' && CLASS.dropBefore, drop.position === 'after' && CLASS.dropAfter)}
  title={invalid ? issues.map((i) => i.message).join('\n') : undefined}
  role="group"
  {...drop.dropProps}
>
  <span class={CLASS.handle} aria-label={ui.labels.drag} role="button" tabindex="-1" {...drag.handleProps}>⠿</span>
  <select class={CLASS.field} value={rule.field} onchange={(e) => r.setField(e.currentTarget.value)}>
    {#each ui.fieldOptions as o (o.value)}
      <option value={o.value}>{o.label}</option>
    {/each}
  </select>
  <select class={CLASS.operator} value={rule.operator} onchange={(e) => r.setOperator(e.currentTarget.value as never)}>
    {#each r.operators as o (o.value)}
      <option value={o.value}>{o.label}</option>
    {/each}
  </select>
  {#if rule.ref !== undefined}
    <select class={CLASS.value} value={rule.ref} onchange={(e) => r.setRef(e.currentTarget.value)}>
      {#each refs as o (o.value)}
        <option value={o.value}>{o.label}</option>
      {/each}
    </select>
  {:else}
    <ValueEditor {editor} def={r.def} value={rule.value} onChange={r.setValue} {invalid} labels={ui.labels} />
  {/if}
  {#if refs.length > 0}
    <button
      type="button"
      class={CLASS.action}
      title={rule.ref === undefined ? ui.labels.compareField : ui.labels.compareValue}
      onclick={() => r.setRef(rule.ref === undefined ? refs[0]!.value : null)}>{rule.ref === undefined ? 'ƒ' : '✎'}</button
    >
  {/if}
  <button type="button" class={CLASS.action} title={ui.labels.clone} aria-label={ui.labels.clone} onclick={r.clone}>⧉</button>
  <button type="button" class={CLASS.action} title={ui.labels.remove} aria-label={ui.labels.remove} onclick={r.remove}>×</button>
</div>
