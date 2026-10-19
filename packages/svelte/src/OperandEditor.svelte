<script lang="ts">
  import { CLASS, defaultCall, isFnCall, type AnyFieldDef, type Fields, type FnCall, type Operand } from '@qnot/core';
  import FunctionEditor from './FunctionEditor.svelte';
  import LazySelect from './LazySelect.svelte';
  import ValueEditor from './ValueEditor.svelte';
  import { editorOf, functionChoices, refChoices } from './reactive';
  import type { Labels } from './ui';

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
  const refs = $derived(refChoices(fields, '', def.kind));
  const nested = $derived(functionChoices(fields, def.kind));
  const sources = $derived([
    { value: 'value', label },
    ...(refs.length > 0 ? [{ value: 'field', label: `${label}: field` }] : []),
    ...(nested.length > 0 ? [{ value: 'function', label: `${label}: ƒ` }] : []),
  ]);
  const source = $derived(isFnCall(operand) ? 'function' : 'ref' in operand ? 'field' : 'value');
</script>

<span class="qn-operand" title={label}>
  {#if refs.length > 0 || nested.length > 0}
    <LazySelect
      class="qn-source"
      value={source}
      options={sources}
      {disabled}
      onChange={(v) => onChange(v === 'field' ? { ref: refs[0]!.value } : v === 'function' ? defaultCall(fields, nested[0]!.value) : { value: def.defaultValue ?? null })}
    />
  {/if}
  {#if source === 'function'}
    <FunctionEditor call={operand as FnCall} {fields} kind={def.kind} {onChange} {disabled} {labels} />
  {:else if source === 'field'}
    <LazySelect class={CLASS.value} value={(operand as { ref: string }).ref} options={refs} {disabled} onChange={(ref) => onChange({ ref })} />
  {:else}
    <ValueEditor
      editor={editorOf(def, 'eq', fields)}
      {def}
      value={(operand as { value: unknown }).value}
      invalid={false}
      {disabled}
      {labels}
      onChange={(value) => onChange({ value })}
    />
  {/if}
</span>
