<script lang="ts">
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import { Popover } from 'bits-ui'
  import Icon from '../shared/Icon.svelte'
  import Checkbox from '../shared/Checkbox.svelte'
  import { RARITY_LABELS } from '../../lib/game-data.js'
  import {
    isCharacterCollection,
    isWeaponOrSummonCollection
  } from '../../lib/detail-helpers.js'

  interface Props {
    element?: 'fire' | 'water' | 'earth' | 'wind' | 'light' | 'dark'
  }

  let { element }: Props = $props()

  let dataType = $derived(app.currentDetailDataType ?? '')
  let showFilter = $derived(
    isWeaponOrSummonCollection(dataType) || isCharacterCollection(dataType) || dataType === 'collection_artifact'
  )
  let showRarityFilters = $derived(isWeaponOrSummonCollection(dataType) || isCharacterCollection(dataType))
  let filterLabel = $derived.by(() => {
    if (!showRarityFilters) return m.filter_options()
    const labels = Array.from(app.activeRarityFilters)
      .sort((a, b) => parseInt(b) - parseInt(a))
      .map((r) => (RARITY_LABELS as Record<string, string>)[r])
      .filter(Boolean)
    return labels.length > 0 ? labels.join('/') : m.filter_default()
  })

  function toggleRarity(rarity: string, checked: boolean) {
    const next = new Set(app.activeRarityFilters)
    if (checked) next.add(rarity)
    else next.delete(rarity)
    app.activeRarityFilters = next
  }

</script>

{#if showFilter}
  <Popover.Root>
    <Popover.Trigger class="filter-trigger">
      <span>{filterLabel}</span>
      <Icon name="chevron-down-small" size={12} />
    </Popover.Trigger>

    <Popover.Content class="filter-content" align="end" sideOffset={4}>
      {#if showRarityFilters}
        <div class="filter-section">
          <div class="filter-section-title">{m.filter_section_rarity()}</div>
          {#each ['4', '3', '2'] as rarity}
            <label class="filter-option">
              <Checkbox
                checked={app.activeRarityFilters.has(rarity)}
                onCheckedChange={(c) => toggleRarity(rarity, c)}
                contained
                size="small"
                {element}
              />
              <span>{(RARITY_LABELS as Record<string, string>)[rarity]}</span>
            </label>
          {/each}
        </div>
      {/if}

    </Popover.Content>
  </Popover.Root>
{/if}
