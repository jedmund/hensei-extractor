<script lang="ts">
  import { onMount } from 'svelte'
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import { fetchLatestGwEvent } from '../../lib/services/chrome-messages.js'
  import type { GwEventSummary } from '../../lib/types/messages.js'
  import Button from '../shared/Button.svelte'
  import EmptyState from '../shared/EmptyState.svelte'
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

  let recentEvent = $state<GwEventSummary | null>(null)

  let eventNumberPadded = $derived(
    recentEvent ? String(recentEvent.eventNumber).padStart(3, '0') : ''
  )

  onMount(async () => {
    try {
      const result = await fetchLatestGwEvent()
      if (result.recent) {
        recentEvent = result.recent
      }
    } catch {
      // Silently fail
    }
  })

  function openDetail(dataType: string) {
    app.currentDetailDataType = dataType
    app.detailViewActive = true
  }
</script>

<div class="panel" class:active={app.activeTab === 'crew'} id="crewPanel">
  <div class="cache-items" id="crewItems">
    {#if unfTypes.length === 0}
      <EmptyState message={m.empty_crew()}>
        {#snippet actions()}
          {#if recentEvent}
            <Button
              size="small"
              onclick={() =>
                chrome.tabs.create({
                  url: `https://game.granbluefantasy.jp/#event/teamraid${eventNumberPadded}/performance`
                })}
            >
              {m.empty_crew_button_honors({ eventNumber: String(recentEvent.eventNumber) })}
            </Button>
          {/if}
          <Button
            size="small"
            onclick={() =>
              chrome.tabs.create({
                url: 'https://game.granbluefantasy.jp/#guild/member'
              })}
          >
            {m.empty_crew_button_members()}
          </Button>
        {/snippet}
      </EmptyState>
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
