<script lang="ts">
  // Editor for a function call: pick the function, then each argument (literal, field, or nested call).
  import { defaultCall, fieldLabel, functionOf, functionOptions, type Fields, type FnCall } from '@trawlnet/core';
  import OperandEditor from './OperandEditor.svelte';
  import type { Labels } from './ui';

  interface Props {
    call: FnCall;
    fields: Fields;
    kind?: string;
    onChange: (c: FnCall) => void;
    disabled?: boolean;
    labels: Labels;
  }
  let { call, fields, kind, onChange, disabled, labels }: Props = $props();
  const fns = $derived(functionOptions(fields, kind));
  const args = $derived(Object.entries(functionOf(fields, call)?.args ?? {}));
</script>

<span class="tn-function">
  <select class="tn-function-name" value={call.fn} {disabled} onchange={(e) => onChange(defaultCall(fields, e.currentTarget.value))}>
    {#each fns as o (o.value)}
      <option value={o.value}>{o.label}</option>
    {/each}
  </select>
  {#if args.length > 0}
    <span class="tn-function-args"
      >({#each args as [name, argDef], i (name)}<span class="tn-function-arg"
          >{#if i > 0}, {/if}<OperandEditor
            operand={call.args[name] ?? { value: null }}
            def={argDef}
            {fields}
            label={fieldLabel(name, argDef)}
            {disabled}
            {labels}
            onChange={(operand) => onChange({ ...call, args: { ...call.args, [name]: operand } })}
          /></span
        >{/each})</span
    >
  {/if}
</span>
