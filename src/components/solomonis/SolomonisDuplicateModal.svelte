<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import { importSolomonisRun } from '../../lib/solomonis/import-run.js'
  import Button from '../shared/Button.svelte'

  let duplicate = $derived(app.solomonisDuplicate)

  function cancel() {
    app.solomonisDuplicate = null
  }

  function view() {
    if (duplicate) chrome.tabs.create({ url: duplicate.url })
    app.solomonisDuplicate = null
  }

  async function update() {
    app.solomonisDuplicate = null
    await importSolomonisRun(true)
  }
</script>

{#if duplicate}
<div class="modal">
  <div class="modal-backdrop" role="button" tabindex="-1" onclick={cancel} onkeydown={(e) => { if (e.key === 'Escape') cancel() }}></div>
  <div class="modal-content">
    <h3 class="modal-title">{m.solomonis_extension_duplicate_title()}</h3>
    <div class="modal-body"><p>{m.solomonis_extension_duplicate_body()}</p></div>

    <div class="modal-actions">
      <Button onclick={cancel}>{m.action_cancel()}</Button>
      <Button onclick={view}>{m.solomonis_extension_duplicate_view()}</Button>
      <Button variant="primary" onclick={update}>{m.solomonis_extension_duplicate_update()}</Button>
    </div>
  </div>
</div>
{/if}
