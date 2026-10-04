<script lang="ts">
  import type { Snippet } from 'svelte'
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import { slideRight } from '../../lib/transitions.js'
  import { decodeHtmlEntities } from '../../lib/html-entities.js'
  import {
    isCollectionType,
    isDatabaseDetailType,
    isCharacterCollection,
    isWeaponOrSummonCollection,
    extractItems,
    countItems
  } from '../../lib/detail-helpers.js'
  import {
    detailLoadPlan,
    ownedIdsFor,
    collectionUpdatesByKey,
    characterStatsUpdatesByKey,
    partyLookups,
    countPartyMembers,
    suggestedRaidSlug,
    findRaidBySlug,
    categorizeItems,
    defaultSelection,
    type PartyDeckData,
    type ItemEntry,
    type CategorySection
  } from '../../lib/detail-data.js'
  import { getCachedData, fetchRaidGroups, fetchElementVariants, getCollectionIds, checkCollectionUpdates, checkCharacterStatsUpdates, searchSummonByName, fetchWeaponKeyMap, fetchWeaponStatModifiers, fetchJobSkillSlugs } from '../../lib/services/chrome-messages.js'
  import { translateError, getLocale } from '../../lib/i18n.js'

  import { onMount } from 'svelte'
  import type { RawGameItem } from '../../lib/detail-helpers.js'
  import type { RaidGroup, CollectionUpdate, SummonSearchResult, WeaponKeyMap, WeaponStatModifiers, JobSkillSlugs } from '../../lib/types/messages.js'

  import NavigationBar from '../shared/NavigationBar.svelte'
  import Icon from '../shared/Icon.svelte'
  import Tooltip from '../shared/Tooltip.svelte'
  import DetailFilter from './DetailFilter.svelte'

  type ElementName = 'fire' | 'water' | 'earth' | 'wind' | 'light' | 'dark'
  let element = $derived((app.auth?.avatar?.element as ElementName) ?? undefined)
  import ItemGrid from './items/ItemGrid.svelte'
  import ItemList from './items/ItemList.svelte'
  import CollapsibleSection from './items/CollapsibleSection.svelte'
  import PartyDetail from './party/PartyDetail.svelte'
  import PartyMeta from './party/PartyMeta.svelte'
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

  function handleScroll(e: Event) {
    const target = e.target as HTMLElement
    scrolled = target.scrollTop > 0
  }

  let dataType = $derived(app.currentDetailDataType ?? '')
  let isParty = $derived(dataType.startsWith('party_'))
  let isDatabase = $derived(isDatabaseDetailType(dataType))
  let isCharStats = $derived(dataType === 'character_stats')
  let isUnfScores = $derived(
    dataType.startsWith('unf_scores_') ||
    dataType.startsWith('unf_daily_scores_')
  )
  let isSupportSummons = $derived(dataType === 'support_summons')
  let isCollection = $derived(
    isCollectionType(dataType) && dataType !== 'character_stats'
  )
  let isArtifact = $derived(dataType === 'collection_artifact')
  let showFilter = $derived(isCollection && !isArtifact)
  let showSyncDeletions = $derived(
    isCollection && !isCharacterCollection(dataType)
  )

  // Ownership data for collection categorization
  let ownedIds = $state<Set<string>>(new Set())
  let ownershipLoaded = $state(false)

  // Pending per-item field deltas from check_updates
  let collectionUpdates = $state<Map<string, CollectionUpdate>>(new Map())

  // Supplementary data for parties
  let friendSummon = $state<SummonSearchResult | null>(null)
  let friendSummonPending = $state(false)
  let weaponKeyMap = $state<WeaponKeyMap | null>(null)
  let jobSkillSlugs = $state<JobSkillSlugs>({})
  let weaponStatModifiers = $state<WeaponStatModifiers | null>(null)
  let simplePortraits = $state(false)

  // Filtered items for collection views (rarity only, no lv1 exclusion — that's a section now)
  let filteredItems = $derived.by(() => {
    if (!app.detailData || isParty || isDatabase || isCharStats || isUnfScores) return [] as ItemEntry[]
    const allItems = extractItems(dataType, app.detailData as Record<string, unknown>)
    return allItems
      .map((item: RawGameItem, index: number) => ({ item, originalIndex: index }))
      .filter(({ item }) => {
        if (isWeaponOrSummonCollection(dataType) || isCharacterCollection(dataType)) {
          const rarity = item.master?.rarity?.toString() || item.rarity?.toString()
          if (rarity && !app.activeRarityFilters.has(rarity)) return false
        }
        return true
      })
  })

  // Categorize items into sections
  let categorizedSections = $derived.by((): CategorySection[] => {
    if (!isCollection || filteredItems.length === 0) return []
    return categorizeItems(dataType, filteredItems, ownedIds, collectionUpdates)
  })

  let hasNames = $derived(
    filteredItems.some(({ item }) => item.name || item.master?.name)
  )

  // Initialize selected items once ownership data is loaded
  let lastInitDataType = $state('')
  $effect(() => {
    if (!isCollection || !ownershipLoaded || categorizedSections.length === 0) return
    if (lastInitDataType === dataType) return
    lastInitDataType = dataType
    app.selectedItems = defaultSelection(categorizedSections, app.manuallyUnchecked)
  })

  // Status and display info
  let status = $derived(app.cachedStatus[dataType] || null)

  let itemCountText = $derived.by(() => {
    if (isParty || !app.detailData) return ''
    if (isCharStats) {
      const count = Object.keys(app.detailData as Record<string, unknown>).length
      return count === 1 ? m.count_character({ count }) : m.count_characters({ count })
    }
    if (isDatabase) {
      const detail = app.detailData as RawGameItem
      return detail?.name || detail?.master?.name || ''
    }
    if (isSupportSummons) {
      const id = (app.detailData as unknown as ParsedSupportSummonPayload).gbf_user_id
      return id ? m.support_summons_user_id({ id }) : ''
    }
    const count = status?.totalItems || countItems(dataType, app.detailData as Record<string, unknown>)
    return count === 1 ? m.count_item({ count }) : m.count_items({ count })
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

    // This component stays mounted between visits, so clear what the last
    // visit left behind. Otherwise the default selection is skipped when the
    // same collection is reopened, or is built from the previous ownership data.
    lastInitDataType = ''
    ownershipLoaded = false
    ownedIds = new Set()
    collectionUpdates = new Map()

    const response = await getCachedData(dt)
    if (!current()) return
    if (response.error) {
      app.showToast(translateError(response.error))
      return
    }

    app.detailData = response.data

    // Get auth for simplePortraits
    const authResult = await chrome.storage.local.get('gbAuth')
    if (!current()) return
    const gbAuth = authResult.gbAuth as Record<string, unknown> | undefined
    simplePortraits = (gbAuth?.simplePortraits as boolean) || false

    const plan = detailLoadPlan(dt)

    // Fetch ownership for collection categorization
    if (plan.ownership) {
      await Promise.all([loadOwnedIds(dt, current), loadCollectionUpdates(dt, current)])
      // Only once both have landed, so items with updates are ticked too
      if (!current()) return
      ownershipLoaded = true
    } else if (plan.characterStatsUpdates) {
      await loadCharacterStatsUpdates(current)
    }

    if (plan.partySupplementary) {
      await loadPartySupplementary(response.data as PartyDeckData, current)
    }

    if (plan.weaponStatModifiers) {
      await loadWeaponStatModifiers(current)
    }
    if (!current()) return

    // Auto-suggest raid for parties
    if (plan.raidSuggestion) {
      const partyData = response.data as PartyDeckData | undefined
      const { weapons, characters } = countPartyMembers(partyData)
      // The game escapes HTML in team names (`A &gt; B`).
      app.partyName = decodeHtmlEntities(partyData?.deck?.name || '')
      await autoSuggestRaid(weapons, characters, current)
    }

    if (!current()) return
    app.detailViewActive = true
  }

  async function loadOwnedIds(dt: string, current: () => boolean) {
    try {
      const response = await getCollectionIds()
      if (!current()) return
      ownedIds = ownedIdsFor(dt, response)
    } catch {
      if (current()) ownedIds = new Set()
    }
  }

  async function loadCollectionUpdates(dt: string, current: () => boolean) {
    // Artifacts don't support partial updates; skip them.
    if (dt.includes('artifact')) {
      collectionUpdates = new Map()
      return
    }
    try {
      const response = await checkCollectionUpdates(dt)
      if (!current()) return
      if (response.error || !response.updates) {
        collectionUpdates = new Map()
        return
      }
      collectionUpdates = collectionUpdatesByKey(response.updates)
    } catch {
      if (current()) collectionUpdates = new Map()
    }
  }

  async function loadCharacterStatsUpdates(current: () => boolean) {
    try {
      const response = await checkCharacterStatsUpdates()
      if (!current()) return
      if (response.error || !response.updates) {
        collectionUpdates = new Map()
        return
      }
      collectionUpdates = characterStatsUpdatesByKey(response.updates)
    } catch {
      if (current()) collectionUpdates = new Map()
    }
  }

  async function loadPartySupplementary(data: PartyDeckData, current: () => boolean) {
    const { summonName, skillNames } = partyLookups(data)

    friendSummon = null
    friendSummonPending = !!summonName
    const [summonResult, keyMap, skillSlugs, statMods] = await Promise.all([
      summonName ? searchSummonByName(summonName) : Promise.resolve(null),
      fetchWeaponKeyMap(getLocale()),
      skillNames.length > 0 ? fetchJobSkillSlugs(skillNames) : Promise.resolve({}),
      fetchWeaponStatModifiers()
    ])
    if (!current()) return

    friendSummon = summonResult
    friendSummonPending = false
    weaponKeyMap = keyMap
    jobSkillSlugs = skillSlugs
    weaponStatModifiers = statMods
  }

  async function loadWeaponStatModifiers(current: () => boolean) {
    const modifiers = await fetchWeaponStatModifiers()
    if (current()) weaponStatModifiers = modifiers
  }

  async function autoSuggestRaid(weaponCount: number, characterCount: number, current: () => boolean) {
    const response = await fetchRaidGroups()
    if (!current() || response.error || !response.data) return
    const slug = suggestedRaidSlug(weaponCount, characterCount)
    const suggested = slug ? findRaidBySlug(response.data as RaidGroup[], slug) : null

    if (suggested) {
      app.selectedRaid = suggested
    }
  }
</script>

{#if app.detailViewActive}
<div class="detail-view" transition:slideRight>
  <NavigationBar {title} {subtitle} {scrolled} bordered={isDatabase || isUnfScores}>
    {#snippet left()}
      <button class="detail-back" onclick={onBack}>
        <Icon name="chevron-left" size={14} />
        <span>{m.action_back()}</span>
      </button>
    {/snippet}
    {#snippet right()}
      {#if navRight}{@render navRight()}{/if}
    {/snippet}
  </NavigationBar>
  {#if !isParty && !isDatabase && !isUnfScores}
    <div class="detail-meta" class:scrolled={isCollection && scrolled}>
      <div class="detail-meta-left">
        {#if showFilter}
          <DetailFilter {element} />
        {:else if isArtifact && showSyncDeletions}
          <Tooltip content={m.filter_enable_sync_desc()}>
            <button
              class="sync-toggle contained"
              class:active={app.enableFullSync}
              onclick={() => { app.enableFullSync = !app.enableFullSync }}
            >
              {m.filter_enable_sync()}
            </button>
          </Tooltip>
        {:else}
          <span class="detail-item-count-standalone" id="detailItemCount">{itemCountText}</span>
        {/if}
      </div>
      {#if showSyncDeletions && !isArtifact}
        <Tooltip content={m.filter_enable_sync_desc()}>
          <button
            class="sync-toggle contained"
            class:active={app.enableFullSync}
            onclick={() => { app.enableFullSync = !app.enableFullSync }}
          >
            {m.filter_enable_sync()}
          </button>
        </Tooltip>
      {/if}
    </div>
  {/if}

  {#if isParty}
    <PartyMeta {scrolled} />
  {/if}

  <div class="detail-items" id="detailItems" onscroll={handleScroll}>
    {#if app.detailData}
      {#if isUnfScores}
        <CrewScoreDetail data={app.detailData as { eventNumber: number; members: { id: string; name: string; contribution: number; rank: number; level: string }[]; totalPages: number; pageCount: number; isComplete: boolean }} />
      {:else if isParty}
        <PartyDetail
          data={app.detailData as Record<string, unknown>}
          {friendSummon}
          {friendSummonPending}
          {weaponKeyMap}
          {jobSkillSlugs}
          {weaponStatModifiers}
          {simplePortraits}
        />
      {:else if isDatabase}
        <DatabaseDetail dataType={dataType} data={app.detailData as Record<string, unknown>} />
      {:else if isCharStats}
        <CharacterStatsList data={app.detailData as Record<string, Record<string, unknown>>} />
      {:else if isSupportSummons}
        <SupportSummonsDetail data={app.detailData as unknown as ParsedSupportSummonPayload} />
      {:else if isCollection && categorizedSections.length > 0}
        {#each categorizedSections as section (section.key)}
          <CollapsibleSection
            title={section.label}
            count={section.items.length}
            defaultOpen={section.defaultExpanded}
            indices={section.items.map((e) => e.originalIndex)}
            {element}
          >
            {#if hasNames}
              <ItemList
                items={section.items}
                {dataType}
                {isCollection}
                {simplePortraits}
                {collectionUpdates}
              />
            {:else}
              <ItemGrid
                items={section.items}
                {dataType}
                {isCollection}
                {simplePortraits}
                {weaponStatModifiers}
                {collectionUpdates}
              />
            {/if}
          </CollapsibleSection>
        {/each}
      {:else if hasNames}
        <ItemList
          items={filteredItems}
          {dataType}
          {isCollection}
          {simplePortraits}
          {collectionUpdates}
        />
      {:else}
        <ItemGrid
          items={filteredItems}
          {dataType}
          {isCollection}
          {simplePortraits}
          {weaponStatModifiers}
          {collectionUpdates}
        />
      {/if}
    {/if}
  </div>
</div>
{/if}
