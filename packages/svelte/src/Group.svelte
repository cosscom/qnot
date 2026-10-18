<script lang="ts">
  import { CLASS, type NodeId } from '@trawlnet/core';
  import Node from './Node.svelte';
  import { createDragHandle, createDropTarget, createGroup, createGroupDropZone, getDndController, getQueryStore } from './reactive';
  import { cx, getUI } from './ui';

  let { id }: { id: NodeId } = $props();
  const store = getQueryStore();
  const dnd = getDndController();
  const ui = getUI();
  // svelte-ignore state_referenced_locally
  const g = createGroup(store, id);
  // svelte-ignore state_referenced_locally
  const drag = createDragHandle(dnd, id);
  // svelte-ignore state_referenced_locally
  const drop = createDropTarget(store, dnd, id);
  // svelte-ignore state_referenced_locally
  const zone = createGroupDropZone(store, dnd, id);
  const group = $derived(g.group);
  const isRoot = $derived(group.parent === null);
</script>

<div
  class={cx(CLASS.group, drag.isDragging && CLASS.dragging, drop.position === 'before' && CLASS.dropBefore, drop.position === 'after' && CLASS.dropAfter)}
  role="group"
  {...isRoot ? {} : drop.dropProps}
>
  <div class={CLASS.groupHeader}>
    {#if !isRoot}
      <span class={CLASS.handle} aria-label={ui.labels.drag} role="button" tabindex="-1" {...drag.handleProps}>⠿</span>
    {/if}
    <label class={CLASS.not}>
      <input type="checkbox" checked={group.not} onchange={(e) => g.setNot(e.currentTarget.checked)} />
      {ui.labels.not}
    </label>
    <select class={CLASS.combinator} value={group.combinator} onchange={(e) => g.setCombinator(e.currentTarget.value as 'and' | 'or')}>
      <option value="and">{ui.labels.and}</option>
      <option value="or">{ui.labels.or}</option>
    </select>
    <button type="button" class={CLASS.action} onclick={() => g.addRule()}>{ui.labels.addRule}</button>
    <button type="button" class={CLASS.action} onclick={() => g.addGroup()}>{ui.labels.addGroup}</button>
    {#if !isRoot}
      <button type="button" class={CLASS.action} title={ui.labels.clone} aria-label={ui.labels.clone} onclick={g.clone}>⧉</button>
      <button type="button" class={CLASS.action} title={ui.labels.remove} aria-label={ui.labels.remove} onclick={g.remove}>×</button>
    {/if}
  </div>
  <div class={cx(CLASS.children, zone.isOver && CLASS.dropInside)} role="list" {...zone.zoneProps}>
    {#each group.children as c (c)}
      <Node id={c} />
    {/each}
  </div>
</div>
