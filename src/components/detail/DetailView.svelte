<script lang="ts">
  import type { Snippet } from 'svelte'
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import { detailViewKind } from '../../lib/detail-data.js'
  import { getCachedData, fetchElementVariants } from '../../lib/services/chrome-messages.js'
  import { translateError } from '../../lib/i18n.js'

  import { onMount } from 'svelte'
  import type { UnfScoresData } from '../../lib/types/messages.js'

  import SlideView from '../shared/SlideView.svelte'
  import DetailScroll from './DetailScroll.svelte'
  import CollectionDetail from './CollectionDetail.svelte'
  import PartyView from './party/PartyView.svelte'
  import DatabaseDetail from './database/DatabaseDetail.svelte'
  import CharacterStatsList from './character-stats/CharacterStatsList.svelte'
  import CrewScoreDetail from './CrewScoreDetail.svelte'
  import SupportSummonsDetail from './SupportSummonsDetail.svelte'
  import type { ParsedSupportSummonPayload } from '../../lib/parsers/support-summons.js'

  interface Props {
    title?: string
    subtitle?: string
    onBack?: () => void
    navRight?: Snippet
  }

  let { title = '', subtitle, onBack, navRight }: Props = $props()

  let scrolled = $state(false)
  let simplePortraits = $state(false)

  let dataType = $derived(app.currentDetailDataType ?? '')
  let kind = $derived(detailViewKind(dataType))

  // The data type the cached capture in app.detailData was loaded for, and
  // which load it came from. Child views get the capture only when it
  // belongs to them, and reload their own lookups when the load changes.
  let loaded = $state<{ dataType: string; generation: number } | null>(null)
  let isLoaded = $derived(loaded?.dataType === dataType && app.detailData != null)
  let data = $derived(isLoaded ? app.detailData : null)
  let generation = $derived(isLoaded ? loaded!.generation : 0)

  let itemCountText = $derived.by(() => {
    if (!data) return ''
    if (kind === 'characterStats') {
      const count = Object.keys(data as Record<string, unknown>).length
      return count === 1 ? m.count_character({ count }) : m.count_characters({ count })
    }
    if (kind === 'supportSummons') {
      const id = (data as ParsedSupportSummonPayload).gbf_user_id
      return id ? m.support_summons_user_id({ id }) : ''
    }
    return ''
  })

  // Fetch data when dataType changes
  $effect(() => {
    const dt = app.currentDetailDataType
    if (!dt) return
    loadDetailData(dt)
  })

  // Reload when new data is captured for the current view
  onMount(() => {
    function onMessage(message: { action: string; dataType?: string }) {
      if (message.action === 'dataCaptured' && message.dataType === dataType) {
        loadDetailData(dataType)
      }
    }
    chrome.runtime.onMessage.addListener(onMessage)
    // Warm the element-variant map so weapon image fallbacks are ready before
    // the first render. Cached with a long TTL in background.ts; this is a no-op
    // on cache hit.
    void fetchElementVariants()
    return () => chrome.runtime.onMessage.removeListener(onMessage)
  })

  // Bumped on every load. A load whose number is no longer the latest, or
  // whose view has been closed or switched, drops its results. Not $state:
  // the fetch effect would otherwise depend on it and re-run.
  let loadSeq = 0

  async function loadDetailData(dt: string) {
    const seq = ++loadSeq
    const current = () => seq === loadSeq && app.currentDetailDataType === dt

    const response = await getCachedData(dt)
    if (!current()) return
    if (response.error) {
      app.showToast(translateError(response.error))
      return
    }

    app.detailData = response.data
    loaded = { dataType: dt, generation: seq }

    // Get auth for simplePortraits
    const authResult = await chrome.storage.local.get('gbAuth')
    if (!current()) return
    const gbAuth = authResult.gbAuth as Record<string, unknown> | undefined
    simplePortraits = (gbAuth?.simplePortraits as boolean) || false

    app.detailViewActive = true
  }
</script>

{#if app.detailViewActive}
<SlideView class="detail-view" {title} {subtitle} {scrolled} bordered={kind === 'database' || kind === 'crewScores'} {onBack} right={navRight}>
  <!-- Keyed so each view starts fresh and is torn down when it's left -->
  {#key dataType}
    {#if kind === 'collection'}
      <CollectionDetail {dataType} {data} {generation} {simplePortraits} bind:scrolled />
    {:else if kind === 'party'}
      <PartyView {dataType} {data} {generation} {simplePortraits} bind:scrolled />
    {:else}
      {#if kind === 'characterStats' || kind === 'supportSummons'}
        <div class="detail-meta">
          <div class="detail-meta-left">
            <span class="detail-item-count-standalone" id="detailItemCount">{itemCountText}</span>
          </div>
        </div>
      {/if}

      <DetailScroll bind:scrolled>
        {#if data}
          {#if kind === 'crewScores'}
            <CrewScoreDetail data={data as UnfScoresData} />
          {:else if kind === 'database'}
            <DatabaseDetail {dataType} data={data as Record<string, unknown>} />
          {:else if kind === 'characterStats'}
            <CharacterStatsList data={data as Record<string, Record<string, unknown>>} />
          {:else if kind === 'supportSummons'}
            <SupportSummonsDetail data={data as ParsedSupportSummonPayload} />
          {/if}
        {/if}
      </DetailScroll>
    {/if}
  {/key}
</SlideView>
{/if}
