<script lang="ts">
  import { app } from '../../lib/state/app.svelte.js'
</script>

<div class="toast" class:visible={app.toastVisible}>
  {app.toastMessage}
</div>
