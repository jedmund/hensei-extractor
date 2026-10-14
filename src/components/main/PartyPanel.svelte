<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import Button from '../shared/Button.svelte'
  import EmptyState from '../shared/EmptyState.svelte'
  import CacheItemRow from './CacheItemRow.svelte'
  import { evokerPortraitUrl } from '../../lib/solomonis/status.js'

  const partyTypes = $derived(
    Object.keys(app.cachedStatus)
      .filter(
        (type) =>
          (type.startsWith('party_') ||
            type.startsWith('solomonis_run_') ||
            type.startsWith('solomonis_deck_')) &&
          app.cachedStatus[type]?.available
      )
      .sort((a, b) => {
        const aTime =
          app.cachedStatus[a]?.timestamp || app.cachedStatus[a]?.lastUpdated || 0
        const bTime =
          app.cachedStatus[b]?.timestamp || app.cachedStatus[b]?.lastUpdated || 0
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
      <EmptyState message={m.empty_party()}>
        {#snippet actions()}
          <Button size="small" onclick={() => chrome.tabs.create({ url: 'https://game.granbluefantasy.jp/#party/index/0/npc/0' })}>
            {m.empty_current_party()}
          </Button>
        {/snippet}
      </EmptyState>
    {:else}
      {#each partyTypes as dataType (dataType)}
        <CacheItemRow
          status={app.cachedStatus[dataType]!}
          {dataType}
          thumbnail={dataType.startsWith('solomonis_deck_') || dataType.startsWith('solomonis_run_')
            ? evokerPortraitUrl(app.cachedStatus[dataType]?.evokerId) || undefined
            : undefined}
          onclick={() => openDetail(dataType)}
        />
      {/each}
    {/if}
  </div>
</div>
