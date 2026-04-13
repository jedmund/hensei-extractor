<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import Button from './Button.svelte'

  interface Props {
    latestVersion: string | null
  }

  let { latestVersion }: Props = $props()

  const currentVersion = chrome.runtime.getManifest().version
  const storeUrl =
    'https://chromewebstore.google.com/detail/hensei-extractor/iecilflpanikaopfihgpoacpefjfafam'
</script>

{#if latestVersion}
  <div class="update-banner update-banner-enter" id="updateBanner">
    <div class="update-banner-text">
      <span>{m.update_available({ version: latestVersion })}</span>
      <span class="update-banner-subtitle">{m.update_current()} {currentVersion}</span>
    </div>
    <Button variant="element-ghost" element="water" size="small" class="update-link" onclick={() => window.open(storeUrl, '_blank')}>
      {m.update_link()}
    </Button>
  </div>
{/if}
