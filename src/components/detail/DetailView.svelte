<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
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

  import DetailHeader from './DetailHeader.svelte'
  import DetailFilter from './DetailFilter.svelte'
  import ItemGrid from './items/ItemGrid.svelte'
  import ItemList from './items/ItemList.svelte'
  import PartyDetail from './party/PartyDetail.svelte'
  import PartyMeta from './party/PartyMeta.svelte'
  import DatabaseDetail from './database/DatabaseDetail.svelte'
  import CharacterStatsList from './character-stats/CharacterStatsList.svelte'

  let dataType = $derived(app.currentDetailDataType ?? '')
  let isParty = $derived(dataType.startsWith('party_'))
  let isDatabase = $derived(isDatabaseDetailType(dataType))
  let isCharStats = $derived(dataType === 'character_stats')
  let isCollection = $derived(
    isCollectionType(dataType) && dataType !== 'character_stats'
  )

  // Supplementary data for parties
  let friendSummon = $state<any>(null)
  let weaponKeyMap = $state<Record<string, string> | null>(null)
  let jobSkillSlugs = $state<Record<string, string>>({})
  let weaponStatModifiers = $state<Record<string, any> | null>(null)
  let simplePortraits = $state(false)

  // Filtered items for collection views
  let filteredItems = $derived.by(() => {
    if (!app.detailData || isParty || isDatabase || isCharStats) return []
    const allItems = extractItems(dataType, app.detailData)
    return allItems
      .map((item: any, index: number) => ({ item, originalIndex: index }))
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
      const count = Object.keys(app.detailData as any).length
      return count === 1 ? m.count_character({ count }) : m.count_characters({ count })
    }
    if (isDatabase) {
      return (app.detailData as any)?.name || (app.detailData as any)?.master?.name || ''
    }
    const count = status?.totalItems || countItems(dataType, app.detailData)
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
      app.showToast(response.error)
      return
    }

    app.detailData = response.data

    // Get auth for simplePortraits
    const { gbAuth } = await chrome.storage.local.get('gbAuth')
    simplePortraits = gbAuth?.simplePortraits || false

    if (dt.startsWith('party_')) {
      await loadPartySupplementary(response.data)
    }

    if (dt.includes('weapon') || dt.startsWith('stash_weapon')) {
      await loadWeaponStatModifiers()
    }

    // Auto-suggest raid for parties
    if (dt.startsWith('party_')) {
      const deck = response.data?.deck || {}
      const pc = deck.pc || {}
      const chars = toArray(deck.npc).filter(Boolean).length
      const wpns = toArray(pc.weapons).filter(Boolean).length
      app.partyName = deck.name || ''
      await autoSuggestRaid(wpns, chars)
    }

    app.detailViewActive = true
  }

  async function loadPartySupplementary(data: any) {
    const summonName = data?.deck?.pc?.damage_info?.summon_name
    const setAction = data?.deck?.pc?.set_action || []
    const skillNames = setAction.map((s: any) => s.name).filter(Boolean)

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
      return results.find((s: any) => s.name?.en === name || s.name?.ja === name) || null
    } catch {
      return null
    }
  }

  let _weaponKeyMapCache: Record<string, string> | null = null
  async function fetchWeaponKeyMap() {
    if (_weaponKeyMapCache) return _weaponKeyMapCache
    try {
      const apiUrl = await getApiUrl('/weapon_keys/skill_map')
      const response = await fetch(apiUrl)
      if (!response.ok) return null
      _weaponKeyMapCache = await response.json()
      return _weaponKeyMapCache
    } catch {
      return null
    }
  }

  let _weaponStatModCache: Record<string, any> | null = null
  async function fetchWeaponStatModifiers() {
    if (_weaponStatModCache) return _weaponStatModCache
    try {
      const apiUrl = await getApiUrl('/weapon_stat_modifiers')
      const response = await fetch(apiUrl)
      if (!response.ok) return null
      const modifiers = await response.json()
      _weaponStatModCache = {} as Record<string, any>
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
    const groups = response.data as any[]
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

  function findRaidBySlug(groups: any[], slug: string) {
    for (const group of groups) {
      const raid = (group.raids || []).find((r: any) => r.slug === slug)
      if (raid) return { ...raid, group }
    }
    return null
  }
</script>

<div class="detail-view" class:active={app.detailViewActive}>
  <DetailHeader />

  {#if !isParty}
    <div class="detail-meta">
      {#if isCollection}
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <!-- svelte-ignore a11y_no_static_element_interactions -->
        <div
          class="select-all-toggle"
          id="selectAllToggle"
          data-state={selectAllState}
          class:disabled={totalCheckboxes === 0}
          onclick={toggleSelectAll}
        >
          <span id="selectAllLabel">{selectAllLabel}</span>
        </div>
      {:else}
        <span class="detail-item-count" id="detailItemCount">{itemCountText}</span>
      {/if}

      <span class="detail-stash-name" id="detailStashName">{stashLabel}</span>
    </div>
  {/if}

  <DetailFilter />

  <div class="detail-items" id="detailItems">
    {#if app.detailData}
      {#if isParty}
        <PartyDetail
          data={app.detailData}
          {friendSummon}
          {weaponKeyMap}
          {jobSkillSlugs}
          {weaponStatModifiers}
          {simplePortraits}
        />
      {:else if isDatabase}
        <DatabaseDetail dataType={dataType} data={app.detailData} />
      {:else if isCharStats}
        <CharacterStatsList data={app.detailData as Record<string, any>} />
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

  {#if isParty}
    <PartyMeta />
  {/if}
</div>
