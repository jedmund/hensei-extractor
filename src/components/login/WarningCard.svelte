<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'

  function acknowledge() {
    chrome.storage.local.set({ noticeAcknowledged: true })
    app.noticeAcknowledged = true
    app.showingDisclaimer = false
  }
</script>

<div class="auth-card">
  <h1 class="auth-title">{m.auth_title()}</h1>
  <div class="auth-body">
    <p>{m.warning_p1()}</p>
    <p>{m.warning_p2()}</p>
    <p>{m.warning_p3()}</p>
  </div>
  <button class="button full" onclick={acknowledge}>
    {m.auth_understand()}
  </button>
</div>
