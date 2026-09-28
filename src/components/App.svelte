<script lang="ts">
  import { onMount } from 'svelte'
  import { app, type AuthData } from '../lib/state/app.svelte.js'
  import { setLocale, getPreferredLocale } from '../lib/i18n.js'
  import { getAuth, getCacheStatus } from '../lib/services/chrome-messages.js'
  import { getImageUrl } from '../lib/constants.js'
  import { Tooltip } from 'bits-ui'
  import LoginView from './login/LoginView.svelte'
  import MainView from './main/MainView.svelte'
  import WarningCard from './login/WarningCard.svelte'
  import ConflictModal from './modals/ConflictModal.svelte'
  import Toast from './shared/Toast.svelte'

  onMount(async () => {
    document.documentElement.style.setProperty(
      '--login-bg-image',
      `url('${getImageUrl('port-breeze.jpg')}')`
    )

    const result = await chrome.storage.local.get(['noticeAcknowledged'])
    // Ask the background worker so an expiring login is refreshed (or cleared)
    // before the panel decides whether to show the login view.
    const gbAuth = await getAuth()
    const noticeAcknowledged = result.noticeAcknowledged as boolean | undefined

    setLocale(getPreferredLocale(gbAuth ?? null))
    app.auth = gbAuth ?? null
    app.noticeAcknowledged = noticeAcknowledged ?? false

    chrome.runtime.onMessage.addListener((message: { action: string; name?: string }) => {
      if (message.action === 'dataCaptured') {
        refreshCaches()
        app.showToast(
          message.name ? `${message.name} data captured!` : 'Data captured!'
        )
      }
    })

    // Follow refreshes and sign-outs made by the background worker.
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local' || !changes.gbAuth) return
      app.auth = (changes.gbAuth.newValue as AuthData | undefined) ?? null
    })

    if (gbAuth?.access_token) {
      await refreshCaches()
    }
  })

  async function refreshCaches() {
    app.cachedStatus = await getCacheStatus()
  }

  $effect(() => {
    if (!app.auth?.access_token) return
    const interval = setInterval(async () => {
      if (Object.keys(app.cachedStatus).length > 0) {
        app.cachedStatus = await getCacheStatus()
      }
    }, 30000)
    return () => clearInterval(interval)
  })
</script>

<Tooltip.Provider>
{#key app.locale}
  {#if app.auth?.access_token}
    <MainView />
  {:else}
    <LoginView />
  {/if}

  {#if app.showingDisclaimer}
    <div class="disclaimer-overlay">
      <WarningCard />
    </div>
  {/if}

  <ConflictModal />
  <Toast />
{/key}
</Tooltip.Provider>
