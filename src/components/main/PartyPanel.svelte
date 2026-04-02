<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import CacheItemRow from './CacheItemRow.svelte'

  const partyTypes = $derived(
    Object.keys(app.cachedStatus)
      .filter(
        (type) => type.startsWith('party_') && app.cachedStatus[type]?.available
      )
      .sort((a, b) => {
        const aTime = app.cachedStatus[a]?.timestamp || 0
        const bTime = app.cachedStatus[b]?.timestamp || 0
        return bTime - aTime
      })
  )

  function openDetail(dataType: string) {
    app.currentDetailDataType = dataType
    app.detailViewActive = true
  }
</script>

<div class="panel" class:active={app.activeTab === 'party'} id="partyPanel">
  <div class="panel-list" id="partyItems">
    {#if partyTypes.length === 0}
      <p class="cache-empty">{m.empty_party()}</p>
    {:else}
      {#each partyTypes as dataType (dataType)}
        <CacheItemRow
          status={app.cachedStatus[dataType]}
          {dataType}
          onclick={() => openDetail(dataType)}
        />
      {/each}
    {/if}
  </div>
</div>
