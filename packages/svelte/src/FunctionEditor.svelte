<script lang="ts">
  // Editor for a function call: pick the function, then each argument (literal, field, or nested call).
  import { defaultCall, fieldLabel, functionOf, type Fields, type FnCall } from '@qnot/core';
  import LazySelect from './LazySelect.svelte';
  import OperandEditor from './OperandEditor.svelte';
  import { functionChoices } from './reactive';
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
  const fns = $derived(functionChoices(fields, kind));
  const args = $derived(Object.entries(functionOf(fields, call)?.args ?? {}));
</script>

<span class="qn-function">
  <LazySelect class="qn-function-name" value={call.fn} options={fns} {disabled} onChange={(fn) => onChange(defaultCall(fields, fn))} />
  {#if args.length > 0}
    <span class="qn-function-args"
      >({#each args as [name, argDef], i (name)}<span class="qn-function-arg"
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
