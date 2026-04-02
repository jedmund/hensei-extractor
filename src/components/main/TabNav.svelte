<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import { getImageUrl } from '../../lib/constants.js'

  const avatarUrl = $derived(
    (app.auth as any)?.avatar?.picture
      ? getImageUrl(`profile/${(app.auth as any).avatar.picture}@2x.png`)
      : getImageUrl('profile/npc@2x.png')
  )

  const showDatabase = $derived((app.auth?.role ?? 0) >= 7)

  function switchTab(tab: 'party' | 'collection' | 'database') {
    app.profilePopoverOpen = false
    app.activeTab = tab
  }

  function togglePopover() {
    app.profilePopoverOpen = !app.profilePopoverOpen
  }
</script>

<nav class="tabs">
  <button
    class="tab"
    class:active={app.activeTab === 'party'}
    onclick={() => switchTab('party')}
  >
    {m.nav_party()}
  </button>
  <button
    class="tab"
    class:active={app.activeTab === 'collection'}
    onclick={() => switchTab('collection')}
  >
    {m.nav_collection()}
  </button>
  {#if showDatabase}
    <button
      class="tab"
      id="databaseTab"
      class:active={app.activeTab === 'database'}
      onclick={() => switchTab('database')}
    >
      {m.nav_database()}
    </button>
  {/if}
  <button
    class="tab profile-tab"
    id="profileButton"
    class:active={app.profilePopoverOpen}
    onclick={togglePopover}
  >
    <img class="tab-avatar" id="tabAvatar" src={avatarUrl} alt="Profile" />
  </button>
</nav>
