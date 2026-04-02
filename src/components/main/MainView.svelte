<script lang="ts">
  import { onMount } from 'svelte'
  import { app } from '../../lib/state/app.svelte.js'
  import { fetchUserInfo } from '../../lib/auth.js'
  const ELEMENT_CLASSES = ['fire', 'water', 'earth', 'wind', 'light', 'dark'] as const
  import { checkExtensionVersion } from '../../lib/services/chrome-messages.js'
  import TabNav from './TabNav.svelte'
  import PartyPanel from './PartyPanel.svelte'
  import CollectionPanel from './CollectionPanel.svelte'
  import DatabasePanel from './DatabasePanel.svelte'
  import ProfilePopover from '../profile/ProfilePopover.svelte'
  import UpdateBanner from '../shared/UpdateBanner.svelte'

  let latestVersion = $state<string | null>(null)

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
  <TabNav />

  <UpdateBanner {latestVersion} />

  <div class="tab-content">
    <PartyPanel />
    <CollectionPanel />
    <DatabasePanel />
  </div>

  <ProfilePopover />

  {#if app.detailViewActive}
    <div class="detail-view active">
      <!-- Detail view content handled by detail components -->
    </div>
  {/if}
</div>
