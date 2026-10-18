<script lang="ts">
  import type { NodeId } from '@trawlnet/core';
  import { createRule, getQueryStore } from '../src/index';
  import { counts } from './counts';

  let { id }: { id: NodeId } = $props();
  // svelte-ignore state_referenced_locally
  const r = createRule(getQueryStore(), id);
  $effect.pre(() => {
    r.rule;
    // svelte-ignore state_referenced_locally
    counts.set(id, (counts.get(id) ?? 0) + 1);
  });
</script>

<input class="counting" value={String(r.rule.value ?? '')} oninput={(e) => r.setValue(e.currentTarget.value)} />
