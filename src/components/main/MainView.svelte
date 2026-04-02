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
    if ((versionResponse as any)?.isOutdated) {
      latestVersion = (versionResponse as any).latest
    }

    // Refresh user info
    const gbAuth = app.auth as any
    if (gbAuth?.access_token) {
      try {
        const userInfo = (await fetchUserInfo(gbAuth.access_token)) as any

        const updated = {
          ...gbAuth,
          avatar: userInfo.avatar,
          displayName: userInfo.display_name || null,
          language: userInfo.language || gbAuth.language,
          role: userInfo.role ?? gbAuth.role,
          simplePortraits: userInfo.simple_portraits || false,
          defaultImportVisibility:
            userInfo.default_import_visibility ??
            gbAuth.defaultImportVisibility,
          hasCrew: !!(
            userInfo.has_crew ||
            userInfo.crew_name ||
            userInfo.gamertag
          ),
          user: {
            ...gbAuth.user,
            username: userInfo.username || gbAuth.user?.username
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
    const element = (app.auth as any)?.avatar?.element
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
