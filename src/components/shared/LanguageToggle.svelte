<!-- LanguageToggle Component -->

<script lang="ts">
  import { Switch as SwitchPrimitive } from 'bits-ui'
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import { setLocale } from '../../lib/i18n.js'
  import { updateUserLanguage } from '../../lib/auth.js'
  import {
    getCacheStatus,
  } from '../../lib/services/chrome-messages.js'

  const isJapanese = $derived(app.locale === 'ja')

  async function handleToggle(checked: boolean) {
    const lang = checked ? 'ja' : 'en'
    if ((app.locale === 'ja') === checked) return

    setLocale(lang)

    // Refresh cache display with translated names
    app.cachedStatus = await getCacheStatus()

    // Persist to server
    const result = await chrome.storage.local.get('gbAuth')
    const gbAuth = result.gbAuth as Record<string, unknown> | undefined
    if (gbAuth?.access_token) {
      gbAuth.language = lang
      await chrome.storage.local.set({ gbAuth })
      try {
        await updateUserLanguage(gbAuth.access_token as string, lang)
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

<!-- svelte-ignore a11y_no_static_element_interactions -->
<div
  class="language-row"
  onpointerdown={(e) => e.stopPropagation()}
  onclick={(e) => e.stopPropagation()}
  onkeydown={(e) => e.stopPropagation()}
>
  <span class="language-label">{m.profile_language()}</span>
  <SwitchPrimitive.Root checked={isJapanese} onCheckedChange={handleToggle} class="language-switch">
    <SwitchPrimitive.Thumb class="language-thumb" />
    <span class="track-label left">JP</span>
    <span class="track-label right">EN</span>
  </SwitchPrimitive.Root>
</div>

<style lang="scss">
  @use 'themes/typography' as typography;
  @use 'themes/spacing' as spacing;
  @use 'themes/effects' as effects;

  .language-row {
    display: flex;
    align-items: center;
    gap: spacing.$unit;
    padding: spacing.$unit calc(spacing.$unit * 1.5);
    width: 100%;
  }

  .language-label {
    flex: 1;
    font-size: typography.$font-small;
    font-weight: typography.$medium;
    color: var(--color-text);
    user-select: none;
  }

  :global(.language-switch) {
    $height: 24px;

    background: #a9a9a9;
    border-radius: calc($height / 2);
    border: none;
    position: relative;
    width: 44px;
    height: $height;
    cursor: pointer;
    flex-shrink: 0;
  }

  :global(.language-thumb) {
    $diameter: 18px;

    background: white;
    border-radius: calc($diameter / 2);
    display: block;
    height: $diameter;
    width: $diameter;
    position: absolute;
    top: 3px;
    left: 3px;
    z-index: 3;
    cursor: pointer;
    @include effects.smooth-transition(effects.$duration-instant, left);
  }

  :global(.language-thumb[data-state='checked']) {
    left: 23px;
  }

  .track-label {
    color: white;
    font-size: 10px;
    font-weight: typography.$bold;
    position: absolute;
    z-index: 2;
    user-select: none;
    pointer-events: none;

    &.left {
      top: 6px;
      left: 6px;
    }

    &.right {
      top: 6px;
      right: 5px;
    }
  }
</style>
