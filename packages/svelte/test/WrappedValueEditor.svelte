<script lang="ts">
  // A custom value editor that wraps the default one.
  import { DefaultValueEditor, type ValueEditorProps } from '../src/index';

  let props: ValueEditorProps = $props();
</script>

<span class="wrap" data-type={props.editor.type}><DefaultValueEditor {...props} /></span>
