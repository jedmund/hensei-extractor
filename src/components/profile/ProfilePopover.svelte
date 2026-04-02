<script lang="ts">
  import { onMount } from 'svelte'
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import { getImageUrl, getSiteBaseUrl } from '../../lib/constants.js'
  import { updateUserLanguage } from '../../lib/auth.js'
  import { setLocale, getLocale } from '../../lib/i18n.js'
  import {
    getCacheStatus,
    clearCache,
    popOutWindow
  } from '../../lib/services/chrome-messages.js'

  let popoverEl: HTMLDivElement | undefined = $state()
  let profileUrl = $state('')
  let isPopupWindow = $state(false)

  const avatarUrl = $derived(
    app.auth?.avatar?.picture
      ? getImageUrl(`profile/${app.auth.avatar.picture}@2x.png`)
      : getImageUrl('profile/npc@2x.png')
  )

  const username = $derived(
    app.auth?.displayName ||
      app.auth?.username ||
      app.auth?.user?.username ||
      'User'
  )

  const isJapanese = $derived(getLocale() === 'ja')
  const version = chrome.runtime.getManifest().version

  onMount(async () => {
    const siteUrl = await getSiteBaseUrl()
    const user = app.auth?.user?.username
    if (user) profileUrl = `${siteUrl}/${user}`

    chrome.windows.getCurrent((win: chrome.windows.Window) => {
      isPopupWindow = win.type === 'popup'
    })
  })

  function handleOutsideClick(e: MouseEvent) {
    if (
      app.profilePopoverOpen &&
      popoverEl &&
      !popoverEl.contains(e.target as Node)
    ) {
      app.profilePopoverOpen = false
    }
  }

  async function handleLanguageToggle() {
    const lang = isJapanese ? 'en' : 'ja'
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

  async function handleClearCache() {
    app.profilePopoverOpen = false
    await clearCache()
    app.cachedStatus = {}
    app.showToast(m.cache_cleared())
  }

  function handleShowDisclaimer() {
    app.profilePopoverOpen = false
    // TODO: Requires App.svelte to check a showingDisclaimer flag
    // so the warning can overlay without logging the user out.
    app.noticeAcknowledged = false
  }

  function handlePopOut() {
    app.profilePopoverOpen = false
    popOutWindow()
  }

  async function handleLogout() {
    app.profilePopoverOpen = false
    await chrome.storage.local.remove(['gbAuth'])
    app.auth = null
    app.cachedStatus = {}
  }
</script>

<svelte:document onclick={handleOutsideClick} />

<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
<div
  class="profile-popover"
  id="profilePopover"
  class:hidden={!app.profilePopoverOpen}
  bind:this={popoverEl}
  onclick={(e) => e.stopPropagation()}
>
  <div class="profile-header">
    <img class="profile-avatar" id="profileAvatar" src={avatarUrl} alt="" />
    <a class="profile-username" id="viewProfile" href={profileUrl} target="_blank">
      {username}
    </a>
  </div>

  <div class="profile-actions">
    <div class="profile-action" id="languageToggle">
      <span class="profile-action-label">{m.profile_language()}</span>
      <button
        class="language-switch"
        role="switch"
        aria-checked={isJapanese}
        onclick={handleLanguageToggle}
      >
        <span class="lang-label" class:active={!isJapanese}>EN</span>
        <span class="lang-label" class:active={isJapanese}>JP</span>
      </button>
    </div>

    <button class="profile-action" id="clearCacheButton" onclick={handleClearCache}>
      {m.profile_clear_cache()}
    </button>

    <button class="profile-action" id="showWarning" onclick={handleShowDisclaimer}>
      {m.profile_show_disclaimer()}
    </button>

    {#if !isPopupWindow}
      <button class="profile-action" id="popOutButton" onclick={handlePopOut}>
        {m.profile_pop_out()}
      </button>
    {/if}

    <button class="profile-action" id="logoutButton" onclick={handleLogout}>
      {m.profile_logout()}
    </button>
  </div>

  <div class="profile-footer">
    <span class="version-label" id="versionLabel">v{version}</span>
  </div>
</div>
