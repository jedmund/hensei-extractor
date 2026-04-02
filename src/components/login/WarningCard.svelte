<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'

  function acknowledge() {
    chrome.storage.local.set({ noticeAcknowledged: true })
    app.noticeAcknowledged = true
  }
</script>

<div class="auth-card">
  <h1>{m.auth_title()}</h1>
  <p>{m.warning_p1()}</p>
  <p>{m.warning_p2()}</p>
  <p>{m.warning_p3()}</p>
  <div class="auth-footer">
    <button class="button primary" onclick={acknowledge}>
      {m.auth_understand()}
    </button>
  </div>
</div>
