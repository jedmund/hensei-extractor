<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import type { AuthData } from '../../lib/auth.js'
  import { loginWithSite } from '../../lib/extension-auth.js'
  import { getLocale } from '../../lib/i18n.js'
  import type { Snippet } from 'svelte'
  import Button from '../shared/Button.svelte'

  interface Props {
    /** Rendered at the bottom of the card, under the sign-up link. */
    footer?: Snippet
  }

  let { footer }: Props = $props()

  // The extension only logs in through granblue.team, so every login method
  // the site supports (password, Discord, Google, Apple) works here.
  let status = $state('')
  let loading = $state(false)

  async function handleSiteLogin() {
    loading = true
    status = m.auth_waiting_for_site()

    try {
      const result = await loginWithSite()
      if (result) {
        await saveAuth(result)
      } else {
        // The user closed the window or cancelled on the site.
        status = ''
        loading = false
      }
    } catch {
      status = m.auth_site_login_failed()
      loading = false
    }
  }

  async function saveAuth(result: AuthData) {
    const gbAuth = { ...result, language: getLocale() }
    await chrome.storage.local.set({ gbAuth })
    app.auth = gbAuth
    status = m.auth_login_success()
  }
</script>

<div class="auth-card">
  <h1 class="auth-title">{m.auth_get_started()}</h1>
  <div class="auth-form">
    {#if status}
      <div class="auth-status">{status}</div>
    {/if}
    <Button
      variant="primary"
      fullWidth
      onclick={handleSiteLogin}
      disabled={loading}
    >
      {m.auth_login_with_site()}
    </Button>
  </div>
  <div class="auth-footer">
    <p>
      {m.auth_no_account()}
      <a href="https://granblue.team/register" target="_blank"
        >{m.auth_create_account()}</a
      >
    </p>
    {@render footer?.()}
  </div>
</div>
