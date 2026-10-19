<script lang="ts" module>
  // A lazy select as a component, for the less hot places (enum values, function pickers). See
  // lazy.ts for how lazy selects work.
  import { Lazy, type LazyOption } from './lazy';

  export type { LazyOption };

  export interface Props {
    options: readonly LazyOption[];
    value: string;
    onChange: (value: string) => void;
    /** Placeholder option with value '' (always rendered). */
    empty?: string;
    /** Group options under `<optgroup>`s by their `group`. */
    grouped?: boolean;
    class?: string;
    disabled?: boolean;
    invalid?: boolean;
    'aria-label'?: string;
  }

  class FromProps extends Lazy {
    readonly props: Props;
    constructor(props: Props) {
      super();
      this.props = props;
    }
    override get options() {
      return this.props.options;
    }
    override get current() {
      return this.props.value;
    }
    override get empty() {
      return this.props.empty;
    }
    override get grouped() {
      return !!this.props.grouped;
    }
  }
</script>
<script lang="ts">
  let props: Props = $props();
  // svelte-ignore state_referenced_locally
  const l = new FromProps(props);
  const { expand } = l;
  const onchange = (e: Event & { currentTarget: HTMLSelectElement }) => props.onChange(e.currentTarget.value);
</script>

<select
  class={props.class}
  disabled={props.disabled}
  aria-label={props['aria-label']}
  aria-invalid={props.invalid || undefined}
  onfocus={expand}
  onpointerdown={expand}
  onmouseenter={expand}
  {onchange}><option value={l.value} disabled={l.disabled} selected>{l.label}</option></select
>
