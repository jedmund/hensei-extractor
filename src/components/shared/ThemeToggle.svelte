<!--
  Light/dark switch for the profile menu, like the site's account menu. It
  saves to the account's theme setting, which the site shares.
-->
<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import { resolveTheme } from '../../lib/theme.js'
  import { updateUserSettings } from '../../lib/auth.js'
  import MenuSwitch from './MenuSwitch.svelte'
  import SunIcon from '../../assets/icons/sun.svg?raw'
  import MoonIcon from '../../assets/icons/moon.svg?raw'

  let systemDark = $state(
    window.matchMedia('(prefers-color-scheme: dark)').matches
  )

  $effect(() => {
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => (systemDark = query.matches)
    query.addEventListener('change', onChange)
    return () => query.removeEventListener('change', onChange)
  })

  const isDark = $derived(resolveTheme(app.auth?.theme, systemDark) === 'dark')

  async function handleToggle(checked: boolean) {
    if (!app.auth) return
    const theme = checked ? 'dark' : 'light'

    // App applies app.auth.theme, so this switches the panel right away
    app.auth = { ...app.auth, theme }

    const result = await chrome.storage.local.get('gbAuth')
    const gbAuth = result.gbAuth as Record<string, unknown> | undefined
    if (!gbAuth?.access_token) return

    gbAuth.theme = theme
    await chrome.storage.local.set({ gbAuth })
    try {
      await updateUserSettings(gbAuth.access_token as string, { theme })
    } catch {
      // Silently fail -- local preference is saved anyway
    }
  }
</script>

<MenuSwitch
  label={m.profile_theme()}
  checked={isDark}
  onCheckedChange={handleToggle}
  trackColor="#d4a017"
  checkedTrackColor="#4a2d7a"
>
  {#snippet left()}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html MoonIcon}
  {/snippet}
  {#snippet right()}
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    {@html SunIcon}
  {/snippet}
</MenuSwitch>
