<script lang="ts">
  import { app } from '../../lib/state/app.svelte.js'
</script>

<!-- Always mounted so screen readers pick up each new message. The key block
     re-creates the text on every toast, so a repeated message is announced too. -->
<div class="toast" class:visible={app.toastVisible} role="status" aria-live="polite" aria-atomic="true">
  {#key app.toastCount}<span>{app.toastMessage}</span>{/key}
</div>
