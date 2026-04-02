<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import { RARITY_LABELS } from '../../lib/game-data.js'
  import {
    isCollectionType,
    isWeaponOrSummonCollection
  } from '../../lib/detail-helpers.js'

  let dropdownOpen = $state(false)

  let dataType = $derived(app.currentDetailDataType ?? '')
  let showFilter = $derived(
    isWeaponOrSummonCollection(dataType) || dataType === 'collection_artifact'
  )
  let showRarityFilters = $derived(isWeaponOrSummonCollection(dataType))
  let showLv1Filter = $derived(isWeaponOrSummonCollection(dataType))
  let showSyncFilter = $derived(
    isCollectionType(dataType) && dataType !== 'character_stats'
  )

  let filterLabel = $derived.by(() => {
    if (!showRarityFilters) return m.filter_options()
    const labels = Array.from(app.activeRarityFilters)
      .sort((a, b) => parseInt(b) - parseInt(a))
      .map((r) => (RARITY_LABELS as Record<string, string>)[r])
      .filter(Boolean)
    return labels.length > 0 ? labels.join('/') : m.filter_default()
  })

  function toggleDropdown(e: MouseEvent) {
    e.stopPropagation()
    dropdownOpen = !dropdownOpen
  }

  function closeDropdown() {
    dropdownOpen = false
  }

  function toggleRarity(rarity: string, checked: boolean) {
    const next = new Set(app.activeRarityFilters)
    if (checked) next.add(rarity)
    else next.delete(rarity)
    app.activeRarityFilters = next
  }

  function toggleLv1(checked: boolean) {
    app.excludeLv1Items = checked
  }

  function toggleSync(checked: boolean) {
    app.enableFullSync = checked
  }
</script>

<svelte:document onclick={closeDropdown} />

{#if showFilter}
  <div class="detail-filter" id="detailFilter">
    <button class="filter-button" id="filterButton" onclick={toggleDropdown}>
      <span>{filterLabel}</span>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
        <path d="M2 4l4 4 4-4" />
      </svg>
    </button>
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="filter-dropdown"
      id="filterDropdown"
      class:open={dropdownOpen}
      onclick={(e) => e.stopPropagation()}
    >
      {#if showRarityFilters}
        <div class="filter-section" id="rarityFilters">
          <div class="filter-section-title">{m.filter_section_rarity()}</div>
          {#each ['4', '3', '2'] as rarity}
            <label class="filter-option">
              <input
                type="checkbox"
                value={rarity}
                checked={app.activeRarityFilters.has(rarity)}
                onchange={(e) => toggleRarity(rarity, (e.target as HTMLInputElement).checked)}
              />
              <span>{(RARITY_LABELS as Record<string, string>)[rarity]}</span>
            </label>
          {/each}
        </div>
      {/if}

      {#if showLv1Filter}
        <div class="filter-section" id="lv1FilterSection">
          <label class="filter-option">
            <input
              type="checkbox"
              id="excludeLv1Checkbox"
              checked={app.excludeLv1Items}
              onchange={(e) => toggleLv1((e.target as HTMLInputElement).checked)}
            />
            <span>{m.filter_exclude_lv1()}</span>
          </label>
          <div class="filter-option-desc">{m.filter_exclude_lv1_desc()}</div>
        </div>
      {/if}

      {#if showSyncFilter}
        <div class="filter-section" id="syncFilterSection">
          <div class="filter-section-title">{m.filter_section_options()}</div>
          <label class="filter-option">
            <input
              type="checkbox"
              id="enableFullSyncCheckbox"
              checked={app.enableFullSync}
              onchange={(e) => toggleSync((e.target as HTMLInputElement).checked)}
            />
            <span>{m.filter_enable_sync()}</span>
          </label>
          <div class="filter-option-desc">{m.filter_enable_sync_desc()}</div>
        </div>
      {/if}
    </div>
  </div>
{/if}
