<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import Button from '../shared/Button.svelte'
  import CacheItemRow from './CacheItemRow.svelte'

  const databaseTypes = $derived(
    Object.keys(app.cachedStatus)
      .filter(
        (type) =>
          (type.startsWith('detail_npc_') ||
            type.startsWith('detail_weapon_') ||
            type.startsWith('detail_summon_')) &&
          app.cachedStatus[type]?.available
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

<div
  class="panel"
  class:active={app.activeTab === 'database'}
  id="databasePanel"
>
  <div class="cache-items" id="databaseItems">
    {#if databaseTypes.length === 0}
      <div class="cache-empty">
        <p>{m.empty_database()}</p>
        <div class="cache-empty-actions">
          <Button size="small" onclick={() => chrome.tabs.create({ url: 'https://game.granbluefantasy.jp/#archive/top' })}>
            {m.empty_journal()}
          </Button>
        </div>
      </div>
    {:else}
      {#each databaseTypes as dataType (dataType)}
        <CacheItemRow
          status={app.cachedStatus[dataType]!}
          {dataType}
          onclick={() => openDetail(dataType)}
        />
      {/each}
    {/if}
  </div>
</div>
