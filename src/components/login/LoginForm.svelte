<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import { performLogin } from '../../lib/auth.js'
  import { setLocale, getLocale } from '../../lib/i18n.js'

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

  function toggleLanguage(e: Event) {
    e.preventDefault()
    const newLang = getLocale() === 'en' ? 'ja' : 'en'
    setLocale(newLang)
  }

  let langSwitchText = $derived(
    getLocale() === 'en' ? '日本語で表示' : 'Switch to English'
  )
</script>

<div class="auth-card">
  <h1 class="auth-title">{m.auth_title()}</h1>
  <div class="auth-form">
    <input
      type="email"
      class="input contained"
      placeholder={m.auth_email()}
      bind:value={email}
      disabled={loading}
    />
    <input
      type="password"
      class="input contained"
      placeholder={m.auth_password()}
      bind:value={password}
      disabled={loading}
      onkeydown={(e) => e.key === 'Enter' && handleLogin()}
    />
    {#if status}
      <p class="auth-status">{status}</p>
    {/if}
    <button
      class="button primary full"
      onclick={handleLogin}
      disabled={loading}
    >
      {m.auth_login()}
    </button>
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
<button type="button" class="login-language-switch" onclick={toggleLanguage}>
  {langSwitchText}
</button>
