<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import { performLogin } from '../../lib/auth.js'
  import { getLocale } from '../../lib/i18n.js'
  import Button from '../shared/Button.svelte'
  import Input from '../shared/Input.svelte'

  let email = $state('')
  let password = $state('')
  let status = $state('')
  let loading = $state(false)

  async function handleLogin() {
    if (!email || !password) {
      status = m.auth_enter_credentials()
      return
    }

    loading = true
    status = m.auth_logging_in()

    try {
      const result = await performLogin(email, password)
      if (result?.access_token) {
        const gbAuth = { ...result, language: getLocale() }
        await chrome.storage.local.set({ gbAuth })
        app.auth = gbAuth
        status = m.auth_login_success()
      } else {
        status = m.auth_invalid_credentials()
        loading = false
      }
    } catch {
      status = m.auth_login_failed()
      loading = false
    }
  }

</script>

<div class="auth-card">
  <h1 class="auth-title">{m.auth_login()}</h1>
  <div class="auth-form">
    <Input
      type="email"
      contained
      placeholder={m.auth_email()}
      bind:value={email}
      disabled={loading}
    />
    <Input
      type="password"
      contained
      placeholder={m.auth_password()}
      bind:value={password}
      disabled={loading}
      onkeydown={(e) => e.key === 'Enter' && handleLogin()}
    />
    {#if status}
      <div class="auth-status">{status}</div>
    {/if}
    <Button
      variant="primary"
      fullWidth
      onclick={handleLogin}
      disabled={loading}
    >
      {m.auth_login()}
    </Button>
  </div>
  <div class="auth-footer">
    <p>
      {m.auth_no_account()}
      <a href="https://granblue.team/register" target="_blank"
        >{m.auth_create_account()}</a
      >
    </p>
  </div>
</div>
