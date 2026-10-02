<script lang="ts">
  import { app } from '../../lib/state/app.svelte.js'
  import { chooseLocale } from '../../lib/i18n.js'
  import WarningCard from './WarningCard.svelte'
  import LoginForm from './LoginForm.svelte'

  function toggleLanguage(e: Event) {
    e.preventDefault()
    const newLang = app.locale === 'en' ? 'ja' : 'en'
    void chooseLocale(newLang)
  }

  let langSwitchText = $derived(
    app.locale === 'en' ? '日本語で表示' : 'Switch to English'
  )
</script>

<div class="view login-view">
  <div class="login-background"></div>
  <div class="login-content">
    {#snippet languageSwitch()}
      <button type="button" class="login-language-switch" onclick={toggleLanguage}>
        {langSwitchText}
      </button>
    {/snippet}

    {#if !app.noticeAcknowledged}
      <WarningCard />
      {@render languageSwitch()}
    {:else}
      <LoginForm>
        <!-- Inside the card, under the sign-up link -->
        {#snippet footer()}
          {@render languageSwitch()}
        {/snippet}
      </LoginForm>
    {/if}
  </div>
</div>
