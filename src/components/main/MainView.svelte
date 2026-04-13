<script lang="ts">
  import { onMount } from 'svelte'
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import { fetchUserInfo } from '../../lib/auth.js'
  import { getImageUrl, getDataTypeName } from '../../lib/constants.js'
  const ELEMENT_CLASSES = ['fire', 'water', 'earth', 'wind', 'light', 'dark'] as const
  import { checkExtensionVersion } from '../../lib/services/chrome-messages.js'
  import NavigationBar from '../shared/NavigationBar.svelte'
  import Icon from '../shared/Icon.svelte'
  import TabNav from './TabNav.svelte'
  import PartyPanel from './PartyPanel.svelte'
  import CollectionPanel from './CollectionPanel.svelte'
  import DatabasePanel from './DatabasePanel.svelte'
  import ProfilePopover from '../profile/ProfilePopover.svelte'
  import UpdateBanner from '../shared/UpdateBanner.svelte'
  import DetailView from '../detail/DetailView.svelte'
  import Button from '../shared/Button.svelte'
  import Tooltip from '../shared/Tooltip.svelte'
  import DetailActions from '../detail/DetailActions.svelte'
  import RaidPicker from '../pickers/RaidPicker.svelte'
  import PlaylistPicker from '../pickers/PlaylistPicker.svelte'

  let latestVersion = $state<string | null>(null)

  const avatarUrl = $derived(
    app.auth?.avatar?.picture
      ? getImageUrl(`profile/${app.auth.avatar.picture}@2x.png`)
      : getImageUrl('profile/npc@2x.png')
  )

  const detailTitle = $derived.by(() => {
    if (app.detailViewActive && app.currentDetailDataType) {
      if (app.currentDetailDataType.startsWith('party_')) {
        return app.partyName || ''
      }
      return getDataTypeName(app.currentDetailDataType)
    }
    return ''
  })

  const playlistPickerTitle = $derived.by(() => {
    if (app.playlistCreateFormOpen) return m.playlist_create_title()
    return m.playlist_select()
  })

  function goBackFromDetail() {
    app.resetDetailState()
  }

  function goBackFromRaidPicker() {
    app.raidPickerOpen = false
  }

  function goBackFromPlaylistPicker() {
    if (app.playlistCreateFormOpen) {
      app.playlistCreateFormOpen = false
      return
    }
    app.playlistPickerOpen = false
  }

  function togglePopover(e: MouseEvent) {
    e.stopPropagation()
    app.profilePopoverOpen = !app.profilePopoverOpen
  }

  onMount(async () => {
    // Check for extension updates
    const versionResponse = await checkExtensionVersion()
    if (versionResponse?.isOutdated && versionResponse.latest) {
      latestVersion = versionResponse.latest
    }

    // Refresh user info
    if (app.auth?.access_token) {
      try {
        const userInfo = await fetchUserInfo(app.auth.access_token) as {
          avatar?: { picture?: string; element?: string }
          display_name?: string
          language?: string
          role?: number
          simple_portraits?: boolean
          default_import_visibility?: number
          has_crew?: boolean
          crew_name?: string
          gamertag?: string
          username?: string
        }

        const updated = {
          ...app.auth,
          avatar: userInfo.avatar,
          displayName: userInfo.display_name || undefined,
          language: userInfo.language || app.auth.language,
          role: userInfo.role ?? app.auth.role,
          simplePortraits: userInfo.simple_portraits || false,
          defaultImportVisibility:
            userInfo.default_import_visibility ??
            app.auth.defaultImportVisibility,
          hasCrew: !!(
            userInfo.has_crew ||
            userInfo.crew_name ||
            userInfo.gamertag
          ),
          user: {
            ...app.auth.user,
            username: userInfo.username || app.auth.user?.username
          }
        }

        await chrome.storage.local.set({ gbAuth: updated })
        app.auth = updated
      } catch {
        // Silently fail -- cached data remains usable
      }
    }
  })

  // Apply element color to body when auth changes
  $effect(() => {
    const element = app.auth?.avatar?.element
    document.body.classList.remove(...ELEMENT_CLASSES)
    if (element && (ELEMENT_CLASSES as readonly string[]).includes(element)) {
      document.body.classList.add(element)
    }
  })
</script>

<div class="view main-view">
  <NavigationBar title="granblue.team">
    {#snippet right()}
      <button
        class="tab-profile"
        id="profileButton"
        class:active={app.profilePopoverOpen}
        onclick={togglePopover}
      >
        <img class="tab-avatar" id="tabAvatar" src={avatarUrl} alt="Profile" />
      </button>
    {/snippet}
  </NavigationBar>

  <TabNav />

  <div class="main-content">
    <UpdateBanner {latestVersion} />

    <div class="tab-content">
      <PartyPanel />
      <CollectionPanel />
      <DatabasePanel />
    </div>
  </div>

  <ProfilePopover />

  <DetailView title={detailTitle} onBack={goBackFromDetail}>
    {#snippet navRight()}
      <DetailActions />
    {/snippet}
  </DetailView>

  <RaidPicker onBack={goBackFromRaidPicker}>
    {#snippet navRight()}
      <Tooltip content={m.raid_reload_tooltip()}>
        <Button variant="ghost" size="small" iconOnly id="raidRefreshBtn" onclick={() => { app.raidRefresh = true }}>
          <Icon name="refresh" size={14} />
        </Button>
      </Tooltip>
    {/snippet}
  </RaidPicker>

  <PlaylistPicker title={playlistPickerTitle} onBack={goBackFromPlaylistPicker}>
    {#snippet navRight()}
      {#if app.playlistCreateFormOpen}
        <Button size="small" id="playlistCreateSubmitNav" disabled={!app.playlistCreateReady} onclick={() => { app.playlistCreateSubmit = true }}>{m.action_create()}</Button>
      {:else}
        <Button size="small" id="playlistCreateBtn" onclick={() => { app.playlistCreateFormOpen = true }}>{m.playlist_new()}</Button>
      {/if}
    {/snippet}
  </PlaylistPicker>
</div>
