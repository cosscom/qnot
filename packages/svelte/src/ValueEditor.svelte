<script lang="ts">
  import { CLASS, formatInput, formatList, parseInput, parseList } from '@qnot/core';
  import AsyncInput from './AsyncInput.svelte';
  import DraftInput from './DraftInput.svelte';
  import LazySelect from './LazySelect.svelte';
  import { indent, type ValueEditorProps } from './ui';

  let { editor, def, value, onChange, invalid, disabled, labels }: ValueEditorProps = $props();
  const pair = $derived(Array.isArray(value) ? value : [null, null]);
  const parse = (raw: string) => parseInput(def, raw);
</script>

{#snippet scalar(v: unknown, set: (v: unknown) => void)}
  {#if editor.async}
    <AsyncInput {def} value={v} onChange={set} {invalid} {disabled} />
  {:else if editor.type === 'boolean'}
    <select
      class={CLASS.value}
      value={formatInput(v)}
      {disabled}
      aria-invalid={invalid || undefined}
      onchange={(e) => set(e.currentTarget.value === '' ? null : e.currentTarget.value === 'true')}
    >
      <option value="">{labels.empty}</option>
      <option value="true">{labels.yes}</option>
      <option value="false">{labels.no}</option>
    </select>
  {:else if editor.type === 'select'}
    <LazySelect class={CLASS.value} value={formatInput(v)} options={editor.options ?? []} empty={labels.empty} {disabled} {invalid} onChange={(raw) => set(parse(raw))} />
  {:else if editor.type === 'number'}
    <DraftInput type="number" value={v} min={def?.min} max={def?.max} step={def?.step} placeholder={def?.placeholder} {parse} format={formatInput} onChange={set} {invalid} {disabled} />
  {:else if editor.type === 'slider'}
    <span class="qn-slider">
      <input
        class={CLASS.value}
        type="range"
        min={def?.min ?? 0}
        max={def?.max ?? 100}
        step={def?.step ?? 1}
        value={typeof v === 'number' ? v : (def?.min ?? 0)}
        {disabled}
        aria-invalid={invalid || undefined}
        oninput={(e) => set(Number(e.currentTarget.value))}
      />
      <output>{formatInput(v)}</output>
    </span>
  {:else if editor.type === 'date' || editor.type === 'time'}
    <DraftInput type={editor.type} value={v} {parse} format={formatInput} onChange={set} {invalid} {disabled} />
  {:else if editor.type === 'datetime'}
    <DraftInput type="datetime-local" value={v} {parse} format={(x) => formatInput(x).slice(0, 16)} onChange={set} {invalid} {disabled} />
  {:else if editor.type === 'textarea'}
    <textarea class={CLASS.value} rows={2} value={formatInput(v)} placeholder={def?.placeholder} {disabled} aria-invalid={invalid || undefined} oninput={(e) => set(e.currentTarget.value)}
    ></textarea>
  {:else}
    <input class={CLASS.value} type="text" value={formatInput(v)} placeholder={def?.placeholder} {disabled} aria-invalid={invalid || undefined} oninput={(e) => set(e.currentTarget.value)} />
  {/if}
{/snippet}

{#if editor.arity === 'two'}
  <span class="qn-value-pair">
    {@render scalar(pair[0], (v) => onChange([v, pair[1]]))}
    <span>{labels.rangeSeparator}</span>
    {@render scalar(pair[1], (v) => onChange([pair[0], v]))}
  </span>
{:else if editor.arity === 'many'}
  {#if editor.async}
    <AsyncInput {def} {value} {onChange} {invalid} {disabled} multiple />
  {:else if editor.type === 'multiselect'}
    <select
      class={CLASS.value}
      multiple
      value={Array.isArray(value) ? value.map(String) : []}
      {disabled}
      aria-invalid={invalid || undefined}
      onchange={(e) => onChange([...e.currentTarget.selectedOptions].map((o) => parseInput(def, o.value)))}
    >
      {#each editor.options ?? [] as o (o.value)}
        <option value={String(o.value)} disabled={o.disabled}>{indent(o.depth) + o.label}</option>
      {/each}
    </select>
  {:else}
    <DraftInput type="text" {value} parse={(raw) => parseList(def, raw)} format={formatList} {onChange} {invalid} {disabled} />
  {/if}
{:else if editor.arity === 'one'}
  {@render scalar(value, onChange)}
{/if}
