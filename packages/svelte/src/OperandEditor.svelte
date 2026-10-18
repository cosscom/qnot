<script lang="ts">
  import { CLASS, editorFor, functionOptions, isFnCall, refOptions, type AnyFieldDef, type Fields, type FnCall, type Operand } from '@trawlnet/core';
  import FunctionEditor from './FunctionEditor.svelte';
  import ValueEditor from './ValueEditor.svelte';
  import { defaultCall, type Labels } from './ui';

  interface Props {
    operand: Operand;
    def: AnyFieldDef;
    fields: Fields;
    label: string;
    onChange: (o: Operand) => void;
    disabled?: boolean;
    labels: Labels;
  }
  let { operand, def, fields, label, onChange, disabled, labels }: Props = $props();
  const refs = $derived(refOptions(fields, '', def.kind));
  const nested = $derived(functionOptions(fields, def.kind));
  const source = $derived(isFnCall(operand) ? 'function' : 'ref' in operand ? 'field' : 'value');
</script>

<span class="tn-operand" title={label}>
  {#if refs.length > 0 || nested.length > 0}
    <select
      class="tn-source"
      value={source}
      {disabled}
      onchange={(e) => {
        const v = e.currentTarget.value;
        onChange(v === 'field' ? { ref: refs[0]!.value } : v === 'function' ? defaultCall(fields, nested[0]!.value) : { value: def.defaultValue ?? null });
      }}
    >
      <option value="value">{label}</option>
      {#if refs.length > 0}<option value="field">{label}: field</option>{/if}
      {#if nested.length > 0}<option value="function">{label}: ƒ</option>{/if}
    </select>
  {/if}
  {#if source === 'function'}
    <FunctionEditor call={operand as FnCall} {fields} kind={def.kind} {onChange} {disabled} {labels} />
  {:else if source === 'field'}
    <select class={CLASS.value} value={(operand as { ref: string }).ref} {disabled} onchange={(e) => onChange({ ref: e.currentTarget.value })}>
      {#each refs as o (o.value)}
        <option value={o.value}>{o.label}</option>
      {/each}
    </select>
  {:else}
    <ValueEditor
      editor={editorFor(def, 'eq', fields)}
      {def}
      value={(operand as { value: unknown }).value}
      invalid={false}
      {disabled}
      {labels}
      onChange={(value) => onChange({ value })}
    />
  {/if}
</span>
