<script lang="ts">
  import * as m from '../../paraglide/messages.js'

  interface Props {
    latestVersion: string | null
  }

  let { latestVersion }: Props = $props()

  const currentVersion = chrome.runtime.getManifest().version
  const storeUrl =
    'https://chromewebstore.google.com/detail/hensei-extractor/iecilflpanikaopfihgpoacpefjfafam'
</script>

{#if latestVersion}
  <div class="update-banner">
    <span>
      {m.update_available()} <strong>{latestVersion}</strong>
      ({m.update_current()} {currentVersion})
    </span>
    <a href={storeUrl} target="_blank" rel="noopener noreferrer">
      {m.update_link()}
    </a>
  </div>
{/if}
