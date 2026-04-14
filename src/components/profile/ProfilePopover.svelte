<script lang="ts">
  import { onMount } from 'svelte'
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import { getImageUrl, getSiteBaseUrl } from '../../lib/constants.js'
  import MenuItem from '../shared/MenuItem.svelte'
  import LanguageToggle from '../shared/LanguageToggle.svelte'
  import {
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

  async function handleClearCache() {
    app.profilePopoverOpen = false
    await clearCache()
    app.cachedStatus = {}
    app.showToast(m.cache_cleared())
  }

  function handleToggleHints() {
    app.hintsEnabled = !app.hintsEnabled
    chrome.storage.local.set({ hintsEnabled: app.hintsEnabled })
    app.profilePopoverOpen = false
  }

  function handleShowDisclaimer() {
    app.profilePopoverOpen = false
    app.showingDisclaimer = true
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
  <div class="profile-actions">
    <a class="profile-header" id="viewProfile" href={profileUrl} target="_blank">
      <img class="avatar-large" id="profileAvatar" src={avatarUrl} alt="" />
      <div class="profile-info">
        <span class="profile-subheader">{m.profile_logged_in_as()}</span>
        <span class="profile-username">{username}</span>
      </div>
      <img class="profile-link-icon" src="/icons/link.svg" alt="" />
    </a>

    <LanguageToggle />

    <div class="popover-divider"></div>

    <MenuItem onclick={handleClearCache}>
      {m.profile_clear_cache()}
    </MenuItem>

    <div class="popover-divider"></div>

    <MenuItem onclick={handleToggleHints}>
      {app.hintsEnabled ? m.profile_hide_hints() : m.profile_show_hints()}
    </MenuItem>

    <MenuItem onclick={handleShowDisclaimer}>
      {m.profile_show_disclaimer()}
    </MenuItem>

    {#if !isPopupWindow}
      <MenuItem onclick={handlePopOut}>
        {m.profile_pop_out()}
      </MenuItem>
    {/if}

    <div class="popover-divider"></div>

    <MenuItem variant="destructive" onclick={handleLogout}>
      {m.profile_logout()}
    </MenuItem>

  </div>
</div>
