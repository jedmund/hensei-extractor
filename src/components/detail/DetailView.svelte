<script lang="ts">
  import type { Snippet } from 'svelte'
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import { slideRight } from '../../lib/transitions.js'
  import { getApiUrl } from '../../lib/constants.js'
  import {
    isCollectionType,
    isDatabaseDetailType,
    isCharacterCollection,
    isWeaponOrSummonCollection,
    extractItems,
    countItems,
    toArray,
    getOwnershipId,
    isLevel1
  } from '../../lib/detail-helpers.js'
  import { getCachedData, fetchRaidGroups, getCollectionIds } from '../../lib/services/chrome-messages.js'
  import { translateError, getLocale } from '../../lib/i18n.js'

  import { onMount } from 'svelte'
  import type { RawGameItem } from '../../lib/detail-helpers.js'
  import type { RaidGroup } from '../../lib/types/messages.js'

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
  let isCollection = $derived(
    isCollectionType(dataType) && dataType !== 'character_stats'
  )
  let isArtifact = $derived(dataType === 'collection_artifact')
  let showFilter = $derived(isCollection && !isArtifact)
  let showSyncDeletions = $derived(
    isCollection && !isCharacterCollection(dataType)
  )

  interface SummonSearchResult {
    granblue_id?: string
    imageSuffix?: string
    name?: { en?: string; ja?: string }
  }

  interface WeaponStatModifier {
    nameEn?: string
    nameJp?: string
    suffix?: string
    [key: string]: unknown
  }

  interface PartyDeckData {
    deck?: {
      pc?: {
        weapons?: Record<string, unknown>
        summons?: Record<string, unknown>
        sub_summons?: Record<string, unknown>
        damage_info?: { summon_name?: string }
        set_action?: Array<{ name: string }>
        [key: string]: unknown
      }
      npc?: Record<string, unknown>
      name?: string
      [key: string]: unknown
    }
    bullet_info?: { set_bullets?: Record<string, unknown> }
    [key: string]: unknown
  }

  // Ownership data for collection categorization
  let ownedIds = $state<Set<string>>(new Set())
  let ownershipLoaded = $state(false)

  // Supplementary data for parties
  let friendSummon = $state<SummonSearchResult | null>(null)
  let weaponKeyMap = $state<Record<string, { slug: string; name: string }> | null>(null)
  let jobSkillSlugs = $state<Record<string, string>>({})
  let weaponStatModifiers = $state<Record<string, WeaponStatModifier> | null>(null)
  let simplePortraits = $state(false)

  type ItemEntry = { item: RawGameItem; originalIndex: number }

  // Filtered items for collection views (rarity only, no lv1 exclusion — that's a section now)
  let filteredItems = $derived.by(() => {
    if (!app.detailData || isParty || isDatabase || isCharStats || isUnfScores) return [] as ItemEntry[]
    const allItems = extractItems(dataType, app.detailData as Record<string, unknown>)
    return allItems
      .map((item: RawGameItem, index: number) => ({ item, originalIndex: index }))
      .filter(({ item, originalIndex }) => {
        if (app.brokenImageIndices.has(originalIndex)) return false
        if (isWeaponOrSummonCollection(dataType) || isCharacterCollection(dataType)) {
          const rarity = item.master?.rarity?.toString() || item.rarity?.toString()
          if (rarity && !app.activeRarityFilters.has(rarity)) return false
        }
        return true
      })
  })

  // Categorize items into sections
  interface CategorySection {
    key: string
    label: string
    items: ItemEntry[]
    defaultExpanded: boolean
  }

  let categorizedSections = $derived.by((): CategorySection[] => {
    if (!isCollection || filteredItems.length === 0) return []
    const willImport: ItemEntry[] = []
    const alreadyOwned: ItemEntry[] = []
    const level1: ItemEntry[] = []

    const showLv1Section = isWeaponOrSummonCollection(dataType)

    for (const entry of filteredItems) {
      const ownershipId = getOwnershipId(dataType, entry.item)
      if (showLv1Section && isLevel1(entry.item)) {
        level1.push(entry)
      } else if (ownershipId && ownedIds.has(ownershipId)) {
        alreadyOwned.push(entry)
      } else {
        willImport.push(entry)
      }
    }

    const sections: CategorySection[] = []
    if (willImport.length > 0) {
      sections.push({ key: 'will_import', label: m.section_will_import(), items: willImport, defaultExpanded: true })
    }
    if (alreadyOwned.length > 0) {
      sections.push({ key: 'already_owned', label: m.section_already_owned(), items: alreadyOwned, defaultExpanded: willImport.length === 0 })
    }
    if (level1.length > 0) {
      sections.push({ key: 'level_1', label: m.section_level_1(), items: level1, defaultExpanded: false })
    }
    return sections
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
    const willImportSection = categorizedSections.find((s) => s.key === 'will_import')
    const next = new Set<number>()
    if (willImportSection) {
      for (const { originalIndex } of willImportSection.items) {
        if (!app.manuallyUnchecked.has(originalIndex)) {
          next.add(originalIndex)
        }
      }
    }
    app.selectedItems = next
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
        lastInitDataType = ''
        loadDetailData(dataType)
      }
    }
    chrome.runtime.onMessage.addListener(onMessage)
    return () => chrome.runtime.onMessage.removeListener(onMessage)
  })

  async function loadDetailData(dt: string) {
    const response = await getCachedData(dt)
    if (response.error) {
      app.showToast(translateError(response.error))
      return
    }

    app.detailData = response.data

    // Get auth for simplePortraits
    const authResult = await chrome.storage.local.get('gbAuth')
    const gbAuth = authResult.gbAuth as Record<string, unknown> | undefined
    simplePortraits = (gbAuth?.simplePortraits as boolean) || false

    // Fetch ownership for collection categorization
    if (isCollectionType(dt) && dt !== 'character_stats') {
      await loadOwnedIds(dt)
    }

    if (dt.startsWith('party_')) {
      await loadPartySupplementary(response.data as PartyDeckData)
    }

    if (dt.includes('weapon') || dt.startsWith('stash_weapon')) {
      await loadWeaponStatModifiers()
    }

    // Auto-suggest raid for parties
    if (dt.startsWith('party_')) {
      const partyData = response.data as PartyDeckData | undefined
      const deck = partyData?.deck
      const pc = deck?.pc
      const chars = toArray(deck?.npc).filter(Boolean).length
      const wpns = toArray(pc?.weapons).filter(Boolean).length
      app.partyName = deck?.name || ''
      await autoSuggestRaid(wpns, chars)
    }

    app.detailViewActive = true
  }

  async function loadOwnedIds(dt: string) {
    ownershipLoaded = false
    try {
      const response = await getCollectionIds()
      if (response.error) { ownedIds = new Set(); return }
      if (dt.includes('weapon') || dt.startsWith('stash_weapon')) {
        ownedIds = new Set(response.weapons || [])
      } else if (dt.includes('summon') || dt.startsWith('stash_summon')) {
        ownedIds = new Set(response.summons || [])
      } else if (dt.includes('artifact')) {
        ownedIds = new Set(response.artifacts || [])
      } else if (dt.includes('npc') || dt.includes('character')) {
        ownedIds = new Set(response.characters || [])
      } else {
        ownedIds = new Set()
      }
    } catch {
      ownedIds = new Set()
    } finally {
      ownershipLoaded = true
    }
  }

  async function loadPartySupplementary(data: PartyDeckData) {
    const summonName = data?.deck?.pc?.damage_info?.summon_name
    const setAction = data?.deck?.pc?.set_action || []
    const skillNames = setAction.map((s) => s.name).filter(Boolean)

    const [summonResult, keyMap, skillSlugs, statMods] = await Promise.all([
      summonName ? searchSummonByName(summonName) : Promise.resolve(null),
      fetchWeaponKeyMap(),
      skillNames.length > 0 ? fetchJobSkillSlugs(skillNames) : Promise.resolve({}),
      fetchWeaponStatModifiers()
    ])

    friendSummon = summonResult
    weaponKeyMap = keyMap
    jobSkillSlugs = skillSlugs
    weaponStatModifiers = statMods
  }

  async function loadWeaponStatModifiers() {
    weaponStatModifiers = await fetchWeaponStatModifiers()
  }

  // API helpers (same logic as popup.js)
  async function searchSummonByName(name: string) {
    if (!name) return null
    try {
      const apiUrl = await getApiUrl('/search/summons')
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ search: { query: name } })
      })
      if (!response.ok) return null
      const json = await response.json()
      const results = json.results || []
      return results.find((s: SummonSearchResult) => s.name?.en === name || s.name?.ja === name) || null
    } catch {
      return null
    }
  }

  let _weaponKeyMapCache: Record<string, { slug: string; name: string }> | null = null
  async function fetchWeaponKeyMap() {
    if (_weaponKeyMapCache) return _weaponKeyMapCache
    try {
      const locale = getLocale()
      const [skillMapRes, weaponKeysRes] = await Promise.all([
        fetch(await getApiUrl('/weapon_keys/skill_map')),
        fetch(await getApiUrl('/weapon_keys'))
      ])
      if (!skillMapRes.ok || !weaponKeysRes.ok) return null
      const skillMap: Record<string, string> = await skillMapRes.json()
      const weaponKeys: Array<{ slug: string; name: Record<string, string> }> = await weaponKeysRes.json()

      const slugToName: Record<string, string> = {}
      for (const key of weaponKeys) {
        slugToName[key.slug] = key.name[locale] || key.name.en || key.slug
      }

      const result: Record<string, { slug: string; name: string }> = {}
      for (const [skillId, slug] of Object.entries(skillMap)) {
        result[skillId] = { slug, name: slugToName[slug] || slug }
      }

      _weaponKeyMapCache = result
      return _weaponKeyMapCache
    } catch {
      return null
    }
  }

  let _weaponStatModCache: Record<string, WeaponStatModifier> | null = null
  async function fetchWeaponStatModifiers() {
    if (_weaponStatModCache) return _weaponStatModCache
    try {
      const apiUrl = await getApiUrl('/weapon_stat_modifiers')
      const response = await fetch(apiUrl)
      if (!response.ok) return null
      const modifiers = await response.json() as Array<{ slug: string; name_en: string; name_jp: string; suffix?: string }>
      _weaponStatModCache = {} as Record<string, WeaponStatModifier>
      for (const mod of modifiers) {
        _weaponStatModCache[mod.slug] = {
          nameEn: mod.name_en,
          nameJp: mod.name_jp,
          suffix: mod.suffix || ''
        }
      }
      return _weaponStatModCache
    } catch {
      return null
    }
  }

  let _jobSkillCache: Record<string, string | null> = {}
  async function fetchJobSkillSlugs(names: string[]) {
    const uncached = names.filter((n) => !(n in _jobSkillCache))
    if (uncached.length === 0) {
      return Object.fromEntries(names.map((n) => [n, _jobSkillCache[n] || null]))
    }
    try {
      const apiUrl = await getApiUrl('/job_skills/resolve')
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ names: uncached })
      })
      if (response.ok) {
        const results = await response.json()
        for (const r of results) _jobSkillCache[r.name] = r.slug
      }
    } catch {
      /* fall through */
    }
    return Object.fromEntries(names.map((n) => [n, _jobSkillCache[n] || null]))
  }

  async function autoSuggestRaid(weaponCount: number, characterCount: number) {
    const response = await fetchRaidGroups()
    if (response.error || !response.data) return
    const groups = response.data as RaidGroup[]
    let suggested = null

    if (weaponCount === 13 && characterCount === 8) {
      suggested = findRaidBySlug(groups, 'versusia')
    } else if (weaponCount === 13 && characterCount === 5) {
      suggested = findRaidBySlug(groups, 'farming-ex')
    } else if (characterCount === 5) {
      suggested = findRaidBySlug(groups, 'farming')
    }

    if (suggested) {
      app.selectedRaid = suggested
    }
  }

  function findRaidBySlug(groups: RaidGroup[], slug: string) {
    for (const group of groups) {
      const raid = (group.raids || []).find((r) => r.slug === slug)
      if (raid) return { ...raid, group }
    }
    return null
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
          {weaponKeyMap}
          {jobSkillSlugs}
          {weaponStatModifiers}
          {simplePortraits}
        />
      {:else if isDatabase}
        <DatabaseDetail dataType={dataType} data={app.detailData as Record<string, unknown>} />
      {:else if isCharStats}
        <CharacterStatsList data={app.detailData as Record<string, Record<string, unknown>>} />
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
              />
            {:else}
              <ItemGrid
                items={section.items}
                {dataType}
                {isCollection}
                {simplePortraits}
                {weaponStatModifiers}
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
        />
      {:else}
        <ItemGrid
          items={filteredItems}
          {dataType}
          {isCollection}
          {simplePortraits}
          {weaponStatModifiers}
        />
      {/if}
    {/if}
  </div>
</div>
{/if}
