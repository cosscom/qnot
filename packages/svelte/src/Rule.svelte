<script lang="ts">
  // The default rule: its row element, with the row's content in RuleBody (which the default group
  // also renders directly into rows it creates itself; see rows.ts).
  import type { NodeId } from '@qnot/core';
  import RuleBody from './RuleBody.svelte';
  import { listenItem, Row } from './rows';
  import { getScope } from './scope';

  let { id }: { id: NodeId } = $props();
  // svelte-ignore state_referenced_locally
  const row = new Row(getScope(), id);
</script>

<div class={row.className} title={row.title} role="group" data-qn-id={row.dropId} {@attach listenItem(row)}><RuleBody {row} /></div>
