<script lang="ts">
  import { CLASS, fieldLabel, type NodeId } from '@trawlnet/core';
  import MatchEditor from './MatchEditor.svelte';
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
  const can = $derived(g.can);
  const arrayLabel = $derived(group.of ? fieldLabel(group.of.field, (isRoot ? store.fields : store.fieldsFor(id))[group.of.field]) : '');
</script>

<div
  class={cx(
    CLASS.group,
    !!group.of && CLASS.arrayGroup,
    g.locked && CLASS.locked,
    drag.isDragging && CLASS.dragging,
    drop.position === 'before' && CLASS.dropBefore,
    drop.position === 'after' && CLASS.dropAfter,
  )}
  role="group"
  {...isRoot ? {} : drop.dropProps}
>
  <div class={CLASS.groupHeader}>
    {#if !isRoot}
      <span class={CLASS.handle} aria-label={ui.labels.drag} role="button" tabindex="-1" {...drag.handleProps}>⠿</span>
    {/if}
    {#if group.of}
      <MatchEditor match={group.of.match} label={arrayLabel} onChange={g.setMatch} disabled={!can.editGroup} labels={ui.labels} />
    {/if}
    {#if ui.showNot}
      <label class={CLASS.not}>
        <input type="checkbox" checked={group.not} disabled={!can.editGroup} onchange={(e) => g.setNot(e.currentTarget.checked)} />
        {ui.labels.not}
      </label>
    {/if}
    <select class={CLASS.combinator} value={group.combinator} disabled={!can.editGroup} onchange={(e) => g.setCombinator(e.currentTarget.value as 'and' | 'or')}>
      <option value="and">{ui.labels.and}</option>
      <option value="or">{ui.labels.or}</option>
    </select>
    <button type="button" class={CLASS.action} disabled={!can.addRule} onclick={() => g.addRule()}>{ui.labels.addRule}</button>
    <button type="button" class={CLASS.action} disabled={!can.addGroup} onclick={() => g.addGroup()}>{ui.labels.addGroup}</button>
    {#if g.arrayFields.length > 0}
      <select
        class="tn-add-array"
        value=""
        disabled={!can.addGroup}
        onchange={(e) => {
          const el = e.currentTarget;
          if (el.value) g.addArrayGroup(el.value);
          el.value = '';
        }}
      >
        <option value="">{ui.labels.addArrayGroup}</option>
        {#each g.arrayFields as o (o.value)}
          <option value={o.value}>{o.label}</option>
        {/each}
      </select>
    {/if}
    {#if ui.showLock}
      <button
        type="button"
        class={CLASS.action}
        disabled={!can.lock}
        aria-pressed={!!group.locked}
        title={group.locked ? ui.labels.unlock : ui.labels.lock}
        onclick={() => g.setLocked(!group.locked)}>{group.locked ? '🔒' : '🔓'}</button
      >
    {/if}
    {#if !isRoot}
      <button type="button" class={CLASS.action} title={ui.labels.clone} aria-label={ui.labels.clone} disabled={!can.clone} onclick={g.clone}>⧉</button>
      <button type="button" class={CLASS.action} title={ui.labels.remove} aria-label={ui.labels.remove} disabled={!can.remove} onclick={g.remove}>×</button>
    {/if}
  </div>
  <div class={cx(CLASS.children, zone.isOver && CLASS.dropInside)} role="list" {...zone.zoneProps}>
    {#each group.children as c (c)}
      <Node id={c} />
    {/each}
  </div>
</div>
