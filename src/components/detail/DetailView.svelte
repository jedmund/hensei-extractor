<script lang="ts">
  import type { Snippet } from 'svelte'
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import { slideRight } from '../../lib/transitions.js'
  import { getDataTypeName } from '../../lib/constants.js'
  import { getApiUrl } from '../../lib/constants.js'
  import {
    isCollectionType,
    isDatabaseDetailType,
    isWeaponOrSummonCollection,
    extractItems,
    countItems,
    toArray
  } from '../../lib/detail-helpers.js'
  import { getCachedData, fetchRaidGroups } from '../../lib/services/chrome-messages.js'
  import { translateError, getLocale } from '../../lib/i18n.js'

  import type { RawGameItem } from '../../lib/detail-helpers.js'
  import type { RaidGroup } from '../../lib/types/messages.js'

  import NavigationBar from '../shared/NavigationBar.svelte'
  import Icon from '../shared/Icon.svelte'
  import DetailFilter from './DetailFilter.svelte'
  import ItemGrid from './items/ItemGrid.svelte'
  import ItemList from './items/ItemList.svelte'
  import PartyDetail from './party/PartyDetail.svelte'
  import PartyMeta from './party/PartyMeta.svelte'
  import DatabaseDetail from './database/DatabaseDetail.svelte'
  import CharacterStatsList from './character-stats/CharacterStatsList.svelte'

  interface Props {
    title?: string
    onBack?: () => void
    navRight?: Snippet
  }

  let { title = '', onBack, navRight }: Props = $props()

  let dataType = $derived(app.currentDetailDataType ?? '')
  let isParty = $derived(dataType.startsWith('party_'))
  let isDatabase = $derived(isDatabaseDetailType(dataType))
  let isCharStats = $derived(dataType === 'character_stats')
  let isCollection = $derived(
    isCollectionType(dataType) && dataType !== 'character_stats'
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

  // Supplementary data for parties
  let friendSummon = $state<SummonSearchResult | null>(null)
  let weaponKeyMap = $state<Record<string, { slug: string; name: string }> | null>(null)
  let jobSkillSlugs = $state<Record<string, string>>({})
  let weaponStatModifiers = $state<Record<string, WeaponStatModifier> | null>(null)
  let simplePortraits = $state(false)

  // Filtered items for collection views
  let filteredItems = $derived.by(() => {
    if (!app.detailData || isParty || isDatabase || isCharStats) return []
    const allItems = extractItems(dataType, app.detailData as Record<string, unknown>)
    return allItems
      .map((item: RawGameItem, index: number) => ({ item, originalIndex: index }))
      .filter(({ item, originalIndex }) => {
        if (app.brokenImageIndices.has(originalIndex)) return false
        if (isWeaponOrSummonCollection(dataType)) {
          const rarity = item.master?.rarity?.toString() || item.rarity?.toString()
          if (rarity && !app.activeRarityFilters.has(rarity)) return false
          if (app.excludeLv1Items) {
            const level = item.param?.level || item.level || item.lv
            if (level === 1 || level === '1') return false
          }
        }
        return true
      })
  })

  let hasNames = $derived(
    filteredItems.some(({ item }) => item.name || item.master?.name)
  )

  // Initialize selected items for collections
  $effect(() => {
    if (!isCollection || filteredItems.length === 0) return
    const next = new Set<number>()
    for (const { originalIndex } of filteredItems) {
      if (!app.manuallyUnchecked.has(originalIndex)) {
        next.add(originalIndex)
      }
    }
    app.selectedItems = next
  })

  // Status and display info
  let status = $derived(app.cachedStatus[dataType] || null)

  let stashLabel = $derived.by(() => {
    if (!status) return getDataTypeName(dataType)
    return status.stashName || status.displayName || getDataTypeName(dataType)
  })

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

  // Select all / deselect all
  let totalCheckboxes = $derived(filteredItems.length)
  let checkedCount = $derived(
    filteredItems.filter(({ originalIndex }) => app.selectedItems.has(originalIndex)).length
  )
  let selectAllState = $derived.by(() => {
    if (totalCheckboxes === 0) return 'unchecked'
    if (checkedCount === 0) return 'unchecked'
    if (checkedCount === totalCheckboxes) return 'checked'
    return 'indeterminate'
  })

  let selectAllLabel = $derived.by(() => {
    if (selectAllState === 'checked') {
      return totalCheckboxes === 1
        ? m.action_deselect_count_one({ count: totalCheckboxes })
        : m.action_deselect_count({ count: totalCheckboxes })
    }
    const remaining = totalCheckboxes - checkedCount
    return remaining === 1
      ? m.action_select_count_one({ count: remaining })
      : m.action_select_count({ count: remaining })
  })

  function toggleSelectAll() {
    if (selectAllState === 'checked') {
      // Deselect all
      const next = new Set<number>()
      const unchecked = new Set(app.manuallyUnchecked)
      for (const { originalIndex } of filteredItems) {
        unchecked.add(originalIndex)
      }
      app.selectedItems = next
      app.manuallyUnchecked = unchecked
    } else {
      // Select all
      const next = new Set<number>()
      const unchecked = new Set<number>()
      for (const { originalIndex } of filteredItems) {
        next.add(originalIndex)
      }
      app.selectedItems = next
      app.manuallyUnchecked = unchecked
    }
  }

  // Fetch data when dataType changes
  $effect(() => {
    const dt = app.currentDetailDataType
    if (!dt) return
    loadDetailData(dt)
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
  <NavigationBar {title}>
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
  {#if !isParty}
    <div class="detail-meta">
      <div class="detail-meta-left">
        {#if isCollection}
          <!-- svelte-ignore a11y_click_events_have_key_events -->
          <!-- svelte-ignore a11y_no_static_element_interactions -->
          <label
            class="select-all-toggle"
            id="selectAllToggle"
            data-state={selectAllState}
            class:disabled={totalCheckboxes === 0}
            onclick={toggleSelectAll}
          >
            <span class="select-all-checkbox" id="selectAllCheckbox">
              <span class="select-all-check"><Icon name="check" size={14} /></span>
              <span class="select-all-dash"><Icon name="minus" size={14} /></span>
            </span>
            <span class="select-all-label" id="selectAllLabel">{selectAllLabel}</span>
          </label>
        {:else}
          <span class="detail-item-count-standalone" id="detailItemCount">{itemCountText}</span>
        {/if}
      </div>

      <span class="detail-meta-center" id="detailStashName">{stashLabel}</span>

      <div class="detail-meta-right">
        <DetailFilter />
      </div>
    </div>
  {/if}

  {#if isParty}
    <PartyMeta />
  {/if}

  <div class="detail-items" id="detailItems">
    {#if app.detailData}
      {#if isParty}
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
