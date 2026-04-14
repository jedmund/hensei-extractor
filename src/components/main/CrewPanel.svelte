<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import Button from '../shared/Button.svelte'
  import CacheItemRow from './CacheItemRow.svelte'

  const unfTypes = $derived(
    Object.keys(app.cachedStatus)
      .filter(
        (type) =>
          (type.startsWith('unf_scores_') ||
            type.startsWith('unf_daily_scores_')) &&
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

<div class="panel" class:active={app.activeTab === 'crew'} id="crewPanel">
  <div class="cache-items" id="crewItems">
    {#if unfTypes.length === 0}
      <div class="cache-empty">
        <p>{m.empty_crew()}</p>
        <div class="cache-empty-actions">
          <Button
            size="small"
            onclick={() =>
              chrome.tabs.create({
                url: 'https://game.granbluefantasy.jp/#event/teamraid'
              })}
          >
            {m.empty_crew_button()}
          </Button>
        </div>
      </div>
    {:else}
      {#each unfTypes as dataType (dataType)}
        <CacheItemRow
          status={app.cachedStatus[dataType]!}
          {dataType}
          onclick={() => openDetail(dataType)}
        />
      {/each}
    {/if}
  </div>
</div>
