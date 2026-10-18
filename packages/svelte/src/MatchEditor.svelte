<script lang="ts">
  // "some / all / none / at least N of Orders where …" for array groups.
  import { countOptions, type Quantifier } from '@trawlnet/core';
  import type { Labels } from './ui';

  let { match, label, onChange, disabled, labels }: { match: Quantifier; label: string; onChange: (m: Quantifier) => void; disabled?: boolean; labels: Labels } = $props();
  const counted = $derived(typeof match === 'object' && match.count !== 'between' ? (match as { count: 'gte'; value: number }) : null);
</script>

<span class="tn-match">
  <select
    class="tn-match-mode"
    value={typeof match === 'string' ? match : 'count'}
    {disabled}
    onchange={(e) => onChange(e.currentTarget.value === 'count' ? { count: 'gte', value: 1 } : (e.currentTarget.value as 'some' | 'all' | 'none'))}
  >
    <option value="some">{labels.some}</option>
    <option value="all">{labels.all}</option>
    <option value="none">{labels.none}</option>
    <option value="count">{labels.count}</option>
  </select>
  {#if counted}
    <select class="tn-match-op" value={counted.count} {disabled} onchange={(e) => onChange({ count: e.currentTarget.value as 'gte', value: counted.value })}>
      {#each countOptions(labels) as o (o.value)}
        <option value={o.value}>{o.label}</option>
      {/each}
    </select>
    <input class="tn-match-count" type="number" min="0" value={counted.value} {disabled} oninput={(e) => onChange({ count: counted.count, value: Number(e.currentTarget.value) })} />
  {/if}
  <span>{labels.matchOf} <strong>{label}</strong> {labels.matchWhere}</span>
</span>
