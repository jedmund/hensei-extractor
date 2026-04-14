<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import { TAB_DATA_TYPES } from '../../lib/constants.js'
  import Button from '../shared/Button.svelte'
  import CacheItemRow from './CacheItemRow.svelte'

  const collectionTypes = $derived.by(() => {
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
      const aTime = app.cachedStatus[a]?.timestamp || 0
      const bTime = app.cachedStatus[b]?.timestamp || 0
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
  <div class="cache-items" id="collectionItems">
    {#if collectionTypes.length === 0}
      <div class="cache-empty">
        <p>{m.empty_collection()}</p>
        <div class="cache-empty-actions">
          <Button size="small" onclick={() => chrome.tabs.create({ url: 'https://game.granbluefantasy.jp/#list' })}>
            {m.empty_inventory()}
          </Button>
          <Button size="small" onclick={() => chrome.tabs.create({ url: 'https://game.granbluefantasy.jp/#container' })}>
            {m.empty_stashes()}
          </Button>
        </div>
      </div>
    {:else}
      {#each collectionTypes as dataType (dataType)}
        <CacheItemRow
          status={app.cachedStatus[dataType]!}
          {dataType}
          onclick={() => openDetail(dataType)}
        />
      {/each}
    {/if}
  </div>
</div>
