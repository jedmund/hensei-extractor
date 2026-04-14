<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import Button from '../shared/Button.svelte'
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
  <div class="cache-items" id="partyItems">
    {#if partyTypes.length === 0}
      <div class="cache-empty">
        <p>{m.empty_party()}</p>
        <div class="cache-empty-actions">
          <Button size="small" onclick={() => chrome.tabs.create({ url: 'https://game.granbluefantasy.jp/#party/index/0/npc/0' })}>
            {m.empty_current_party()}
          </Button>
        </div>
      </div>
    {:else}
      {#each partyTypes as dataType (dataType)}
        <CacheItemRow
          status={app.cachedStatus[dataType]!}
          {dataType}
          onclick={() => openDetail(dataType)}
        />
      {/each}
    {/if}
  </div>
</div>
