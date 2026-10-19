<script lang="ts" module>
  import type { Fields, Format, QueryStore, StoreSettings } from '@qnot/core';
  import type { Components, Labels } from './ui';

  export interface QueryBuilderProps<T> {
    store?: QueryStore<any, T>;
    fields?: Fields;
    initial?: T;
    format?: Format<T>;
    /** Store settings; changes are applied live. */
    settings?: StoreSettings;
    /** Controlled value in `format`'s shape; supports `bind:value`. */
    value?: T;
    onchange?: (value: T) => void;
    components?: Partial<Components>;
    labels?: Partial<Labels>;
    class?: string;
    /** Show the NOT toggle on groups (default true). */
    showNot?: boolean;
    /** Show lock toggles on rules and groups (default false). */
    showLock?: boolean;
  }
</script>

<script lang="ts" generics="T = unknown">
  // Ready-made builder. Pass a `store`, or `fields` (+ `initial` / `bind:value`, `format`) and it creates one.
  import { CLASS, createQueryStore } from '@qnot/core';
  import { onDestroy } from 'svelte';
  import Group from './Group.svelte';
  import Rule from './Rule.svelte';
  import ValueEditor from './ValueEditor.svelte';
  import { setQueryStore } from './reactive';
  import { DEFAULT_LABELS, setUI } from './ui';

  let {
    store: given,
    fields,
    initial,
    format,
    settings,
    value = $bindable(),
    onchange,
    components,
    labels,
    class: className,
    showNot = true,
    showLock = false,
  }: QueryBuilderProps<T> = $props();

  // Store identity and options are read once, like the other bindings.
  // svelte-ignore state_referenced_locally
  const store: QueryStore<any, T> =
    given ??
    (() => {
      if (!fields) throw new Error('qnot: <QueryBuilder> needs a `store` or `fields`');
      return createQueryStore({ fields, initial: value !== undefined ? value : initial, format, ...(settings && { settings }) } as never) as QueryStore<any, T>;
    })();

  // Assigning to a $bindable prop wraps the query in a deep $state proxy, so identity checks can't
  // recognise our own echo. A flag skips it instead; genuinely external values are snapshotted so the
  // store never holds proxies.
  let echo = false;
  let first = true;
  $effect.pre(() => {
    const v = value;
    if (first || echo) {
      first = echo = false;
      return;
    }
    if (v !== undefined) store.setValue($state.snapshot(v) as T);
  });

  // svelte-ignore state_referenced_locally
  let appliedSettings = settings;
  $effect.pre(() => {
    if (settings && settings !== appliedSettings) store.setSettings((appliedSettings = settings));
  });

  const unsub = store.subscribe(() => {
    const v = store.getValue();
    echo = true;
    value = v;
    onchange?.(v);
  });
  onDestroy(() => {
    unsub();
    if (!given) store.dispose();
  });

  setQueryStore(store);
  // svelte-ignore state_referenced_locally
  setUI({
    labels: { ...DEFAULT_LABELS, ...labels },
    components: { Group, Rule, ValueEditor, ...components },
    // svelte-ignore state_referenced_locally
    showNot,
    // svelte-ignore state_referenced_locally
    showLock,
  });
  // svelte-ignore state_referenced_locally
  const RootGroup = (components?.Group ?? Group);
</script>

<div class={className ? `${CLASS.root} ${className}` : CLASS.root}>
  <RootGroup id={store.rootId} />
</div>
