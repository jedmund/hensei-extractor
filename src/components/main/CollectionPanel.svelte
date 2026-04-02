<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import { TAB_DATA_TYPES } from '../../lib/constants.js'
  import CacheItemRow from './CacheItemRow.svelte'

  const collectionTypes = $derived(() => {
    const staticTypes = (TAB_DATA_TYPES.collection || []).filter(
      (type) => app.cachedStatus[type]?.available
    )

    const stashTypes = Object.keys(app.cachedStatus).filter(
      (type) =>
        (type.startsWith('stash_weapon_') ||
          type.startsWith('stash_summon_')) &&
        app.cachedStatus[type]?.available
    )

    const all = [...staticTypes, ...stashTypes]

    all.sort((a, b) => {
      const aTime = (app.cachedStatus[a] as any)?.lastUpdated || 0
      const bTime = (app.cachedStatus[b] as any)?.lastUpdated || 0
      return bTime - aTime
    })

    return all
  })

  function openDetail(dataType: string) {
    app.currentDetailDataType = dataType
    app.detailViewActive = true
  }
</script>

<div
  class="panel"
  class:active={app.activeTab === 'collection'}
  id="collectionPanel"
>
  <div class="panel-list" id="collectionItems">
    {#if collectionTypes().length === 0}
      <p class="cache-empty">{m.empty_collection()}</p>
    {:else}
      {#each collectionTypes() as dataType (dataType)}
        <CacheItemRow
          status={app.cachedStatus[dataType]}
          {dataType}
          onclick={() => openDetail(dataType)}
        />
      {/each}
    {/if}
  </div>
</div>
