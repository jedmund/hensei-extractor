<!-- LanguageToggle Component -->

<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import { chooseLocale } from '../../lib/i18n.js'
  import { updateUserSettings } from '../../lib/auth.js'
  import { getCacheStatus } from '../../lib/services/chrome-messages.js'
  import MenuSwitch from './MenuSwitch.svelte'

  const isJapanese = $derived(app.locale === 'ja')

  async function handleToggle(checked: boolean) {
    const lang = checked ? 'ja' : 'en'
    if ((app.locale === 'ja') === checked) return

    await chooseLocale(lang)

    // Refresh cache display with translated names
    app.cachedStatus = await getCacheStatus()

    // Persist to server
    const result = await chrome.storage.local.get('gbAuth')
    const gbAuth = result.gbAuth as Record<string, unknown> | undefined
    if (gbAuth?.access_token) {
      gbAuth.language = lang
      await chrome.storage.local.set({ gbAuth })
      try {
        await updateUserSettings(gbAuth.access_token as string, {
          language: lang
        })
      } catch {
        // Silently fail -- local preference is saved anyway
      }
    }

    // Sync website locale cookie
    if (lang === 'en') {
      chrome.cookies.remove({
        url: 'https://granblue.team',
        name: 'PARAGLIDE_LOCALE'
      })
    } else {
      chrome.cookies.set({
        url: 'https://granblue.team',
        name: 'PARAGLIDE_LOCALE',
        value: lang,
        path: '/',
        sameSite: 'lax',
        expirationDate: Math.floor(Date.now() / 1000) + 34560000
      })
    }
  }
</script>

<MenuSwitch
  label={m.profile_language()}
  checked={isJapanese}
  onCheckedChange={handleToggle}
>
  {#snippet left()}JP{/snippet}
  {#snippet right()}EN{/snippet}
</MenuSwitch>
