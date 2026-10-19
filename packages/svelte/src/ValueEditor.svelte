<script lang="ts" module>
  import { formatInput as fmt, type EditorSpec } from '@qnot/core';
  import type { ValueEditorProps } from './ui';

  /** Derived bits the template reads, as prototype getters over the props object. */
  class View {
    readonly props: ValueEditorProps;
    constructor(props: ValueEditorProps) {
      this.props = props;
    }
    get pair() {
      return Array.isArray(this.props.value) ? this.props.value : [null, null];
    }
    get text() {
      return fmt(this.props.value);
    }
    get invalid() {
      return this.props.invalid || undefined;
    }
    get placeholder() {
      return this.props.def?.placeholder;
    }
    get min() {
      return this.props.def?.min;
    }
    get max() {
      return this.props.def?.max;
    }
    get step() {
      return this.props.def?.step;
    }
  }

  const single = new WeakMap<EditorSpec, EditorSpec>();
  /** The one-value editor each side of a range ("between") uses. */
  const sideOf = (editor: EditorSpec): EditorSpec => {
    let one = single.get(editor);
    if (!one) single.set(editor, (one = { ...editor, arity: 'one' }));
    return one;
  };
</script>

<script lang="ts">
  // One flat chain of branches, so the common single-value editors cost one block per rule; a
  // range renders two single-value editors.
  import { CLASS, formatInput, formatList, parseInput, parseList } from '@qnot/core';
  import AsyncInput from './AsyncInput.svelte';
  import DraftInput from './DraftInput.svelte';
  import LazySelect from './LazySelect.svelte';
  import Self from './ValueEditor.svelte';
  import { indent } from './ui';

  const props: ValueEditorProps = $props();
  const parse = (raw: string) => parseInput(props.def, raw);
  // svelte-ignore state_referenced_locally
  const view = new View(props);
  const formatDatetime = (x: unknown) => formatInput(x).slice(0, 16);
</script>

{#if props.editor.arity === 'two'}
  <span class="qn-value-pair">
    <Self editor={sideOf(props.editor)} def={props.def} value={view.pair[0]} onChange={(v) => props.onChange([v, view.pair[1]])} invalid={props.invalid} disabled={props.disabled} labels={props.labels} />
    <span>{props.labels.rangeSeparator}</span>
    <Self editor={sideOf(props.editor)} def={props.def} value={view.pair[1]} onChange={(v) => props.onChange([view.pair[0], v])} invalid={props.invalid} disabled={props.disabled} labels={props.labels} />
  </span>
{:else if props.editor.arity === 'many'}
  {#if props.editor.async}
    <AsyncInput def={props.def} value={props.value} onChange={props.onChange} invalid={props.invalid} disabled={props.disabled} multiple />
  {:else if props.editor.type === 'multiselect'}
    <select
      class={CLASS.value}
      multiple
      value={Array.isArray(props.value) ? props.value.map(String) : []}
      disabled={props.disabled}
      aria-invalid={props.invalid || undefined}
      onchange={(e) => props.onChange([...e.currentTarget.selectedOptions].map((o) => parseInput(props.def, o.value)))}
    >
      {#each props.editor.options ?? [] as o (o.value)}
        <option value={String(o.value)} disabled={o.disabled}>{indent(o.depth) + o.label}</option>
      {/each}
    </select>
  {:else}
    <DraftInput type="text" value={props.value} parse={(raw) => parseList(props.def, raw)} format={formatList} onChange={props.onChange} invalid={props.invalid} disabled={props.disabled} />
  {/if}
{:else if props.editor.arity !== 'one'}
  <!-- no value -->
{:else if props.editor.async}
  <AsyncInput def={props.def} value={props.value} onChange={props.onChange} invalid={props.invalid} disabled={props.disabled} />
{:else if props.editor.type === 'text'}
  <input class="qn-value" type="text" value={view.text} placeholder={view.placeholder} disabled={props.disabled} aria-invalid={view.invalid} oninput={(e) => props.onChange(e.currentTarget.value)} />
{:else if props.editor.type === 'number'}
  <DraftInput type="number" value={props.value} min={view.min} max={view.max} step={view.step} placeholder={view.placeholder} {parse} format={formatInput} onChange={props.onChange} invalid={props.invalid} disabled={props.disabled} />
{:else if props.editor.type === 'boolean'}
  <select class="qn-value" value={view.text} disabled={props.disabled} aria-invalid={view.invalid} onchange={(e) => props.onChange(e.currentTarget.value === '' ? null : e.currentTarget.value === 'true')}>
    <option value="">{props.labels.empty}</option>
    <option value="true">{props.labels.yes}</option>
    <option value="false">{props.labels.no}</option>
  </select>
{:else if props.editor.type === 'select'}
  <LazySelect class="qn-value" value={view.text} options={props.editor.options ?? []} empty={props.labels.empty} disabled={props.disabled} invalid={props.invalid} onChange={(raw) => props.onChange(parse(raw))} />
{:else if props.editor.type === 'slider'}
  <span class="qn-slider">
    <input
      class={CLASS.value}
      type="range"
      min={props.def?.min ?? 0}
      max={props.def?.max ?? 100}
      step={props.def?.step ?? 1}
      value={typeof props.value === 'number' ? props.value : (props.def?.min ?? 0)}
      disabled={props.disabled}
      aria-invalid={props.invalid || undefined}
      oninput={(e) => props.onChange(Number(e.currentTarget.value))}
    />
    <output>{formatInput(props.value)}</output>
  </span>
{:else if props.editor.type === 'date' || props.editor.type === 'time'}
  <DraftInput type={props.editor.type} value={props.value} {parse} format={formatInput} onChange={props.onChange} invalid={props.invalid} disabled={props.disabled} />
{:else if props.editor.type === 'datetime'}
  <DraftInput type="datetime-local" value={props.value} {parse} format={formatDatetime} onChange={props.onChange} invalid={props.invalid} disabled={props.disabled} />
{:else if props.editor.type === 'textarea'}
  <textarea class={CLASS.value} rows={2} value={view.text} placeholder={view.placeholder} disabled={props.disabled} aria-invalid={view.invalid} oninput={(e) => props.onChange(e.currentTarget.value)}></textarea>
{:else}
  <input class="qn-value" type="text" value={view.text} placeholder={view.placeholder} disabled={props.disabled} aria-invalid={view.invalid} oninput={(e) => props.onChange(e.currentTarget.value)} />
{/if}
