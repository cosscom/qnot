<script lang="ts">
  import { CLASS, formatInput, formatList, parseInput, parseList } from '@trawlnet/core';
  import DraftInput from './DraftInput.svelte';
  import type { ValueEditorProps } from './ui';

  let { editor, def, value, onChange, invalid, labels }: ValueEditorProps = $props();
  const pair = $derived(Array.isArray(value) ? value : [null, null]);
</script>

{#snippet scalar(v: unknown, set: (v: unknown) => void)}
  {#if editor.type === 'boolean'}
    <select
      class={CLASS.value}
      value={formatInput(v)}
      aria-invalid={invalid || undefined}
      onchange={(e) => set(e.currentTarget.value === '' ? null : e.currentTarget.value === 'true')}
    >
      <option value="">{labels.empty}</option>
      <option value="true">{labels.yes}</option>
      <option value="false">{labels.no}</option>
    </select>
  {:else if editor.type === 'select'}
    <select class={CLASS.value} value={formatInput(v)} aria-invalid={invalid || undefined} onchange={(e) => set(parseInput(def, e.currentTarget.value))}>
      <option value="">{labels.empty}</option>
      {#each editor.options ?? [] as o (o.value)}
        <option value={String(o.value)}>{o.label}</option>
      {/each}
    </select>
  {:else if editor.type === 'number' || editor.type === 'date'}
    <DraftInput type={editor.type} value={v} parse={(raw) => parseInput(def, raw)} format={formatInput} onChange={set} {invalid} />
  {:else}
    <input class={CLASS.value} type="text" value={formatInput(v)} aria-invalid={invalid || undefined} oninput={(e) => set(e.currentTarget.value)} />
  {/if}
{/snippet}

{#if editor.arity === 'two'}
  <span class="tn-value-pair">
    {@render scalar(pair[0], (v) => onChange([v, pair[1]]))}
    <span>{labels.rangeSeparator}</span>
    {@render scalar(pair[1], (v) => onChange([pair[0], v]))}
  </span>
{:else if editor.arity === 'many'}
  {#if editor.type === 'multiselect'}
    <select
      class={CLASS.value}
      multiple
      value={Array.isArray(value) ? value.map(String) : []}
      aria-invalid={invalid || undefined}
      onchange={(e) => onChange([...e.currentTarget.selectedOptions].map((o) => parseInput(def, o.value)))}
    >
      {#each editor.options ?? [] as o (o.value)}
        <option value={String(o.value)}>{o.label}</option>
      {/each}
    </select>
  {:else}
    <DraftInput type="text" {value} parse={(raw) => parseList(def, raw)} format={formatList} {onChange} {invalid} />
  {/if}
{:else if editor.arity === 'one'}
  {@render scalar(value, onChange)}
{/if}
