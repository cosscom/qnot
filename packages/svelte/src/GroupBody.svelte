<script lang="ts">
  // A group's header and children (the group element itself is rendered by the default Group or,
  // for nested default groups, by their parent here). With the default Rule and Group, each child's
  // root element is rendered right in the each block, from state the group creates (rows.ts), so
  // rows go straight into their container; custom components get the plain component per child.
  import type { NodeId } from '@qnot/core';
  import GroupBody from './GroupBody.svelte';
  import MatchEditor from './MatchEditor.svelte';
  import RuleBody from './RuleBody.svelte';
  import { nodeKind } from './reactive';
  import type { Box, Row } from './rows';

  let props: { box: Box } = $props();
  // svelte-ignore state_referenced_locally
  const { box } = props;
  const { g, scope } = box;
  const { labels, components, showNot, showLock } = scope.ui;
  const { Group: GroupView, Rule: RuleView } = components;
  const isGroup = (c: NodeId) => nodeKind(scope.store, c) === 'group';
  // Parts fixed for the group's life are picked once rather than wrapped in blocks.
  const handle = box.isRoot ? undefined : handleSnippet;
  const actions = box.isRoot ? undefined : actionsSnippet;
  const not = showNot ? notSnippet : undefined;
  const lock = showLock ? lockSnippet : undefined;
  const children = scope.inline ? inlineChildren : componentChildren;
</script>

{#snippet handleSnippet()}
  <span class="qn-handle" aria-label={labels.drag} role="button" tabindex="-1" draggable="true">⠿</span>
{/snippet}

{#snippet notSnippet()}
  <label class="qn-not">
    <input type="checkbox" checked={g.group.not} disabled={box.noEditGroup} onchange={box.setNot} />
    {labels.not}
  </label>
{/snippet}

{#snippet lockSnippet()}
  <button type="button" class="qn-action" disabled={box.noLock} aria-pressed={box.lockPressed} title={box.lockTitle} onclick={box.toggleLock}>{box.lockIcon}</button>
{/snippet}

{#snippet actionsSnippet()}
  <button type="button" class="qn-action" title={labels.clone} aria-label={labels.clone} disabled={box.noClone} onclick={g.clone}>⧉</button
  ><button type="button" class="qn-action" title={labels.remove} aria-label={labels.remove} disabled={box.noRemove} onclick={g.remove}>×</button>
{/snippet}

<!-- Each list is the only child of its container, so items go straight into it. Rows the group
     renders itself share one set of listeners on the container (Box.listen). -->
{#snippet inlineChildren()}
  <div class={box.childrenClass} role="list" {@attach box.listen}>
    {#each box.children as c (c)}
      {@const x = box.item(c)}
      <div class={x.className} title={x.title} role="group" data-qn-id={x.dropId}
        >{#if x.isGroup}<GroupBody box={x as Box} />{:else}<RuleBody row={x as Row} />{/if}</div
      >
    {/each}
  </div>
{/snippet}

{#snippet componentChildren()}
  <div class={box.childrenClass} role="list" ondragover={box.zone.zoneProps.ondragover} ondrop={box.zone.zoneProps.ondrop}>
    {#each box.children as c (c)}
      {#if isGroup(c)}
        <GroupView id={c} />
      {:else}
        <RuleView id={c} />
      {/if}
    {/each}
  </div>
{/snippet}

<!-- No whitespace between flex children: it would only add text nodes. -->
<div class="qn-group-header"
  >{@render handle?.()}{#if g.group.of}
    <MatchEditor match={g.group.of.match} label={box.arrayLabel} onChange={g.setMatch} disabled={box.noEditGroup} {labels} />
  {/if}{@render not?.()}<select class="qn-combinator" value={g.group.combinator} disabled={box.noEditGroup} onchange={box.setCombinator}
    ><option value="and">{labels.and}</option><option value="or">{labels.or}</option></select
  ><button type="button" class="qn-action" disabled={box.noAddRule} onclick={box.addRule}>{labels.addRule}</button
  ><button type="button" class="qn-action" disabled={box.noAddGroup} onclick={box.addGroup}>{labels.addGroup}</button
  >{#if g.arrayFields.length > 0}
    <select class="qn-add-array" value="" disabled={box.noAddGroup} onchange={box.addArrayGroup}>
      <option value="">{labels.addArrayGroup}</option>
      {#each g.arrayFields as o (o.value)}
        <option value={o.value}>{o.label}</option>
      {/each}
    </select>
  {/if}{@render lock?.()}{@render actions?.()}</div
>{@render children()}
