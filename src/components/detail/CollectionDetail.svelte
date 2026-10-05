<script lang="ts">
  import { onDestroy, untrack } from 'svelte'
  import * as m from '../../paraglide/messages.js'
  import { app } from '../../lib/state/app.svelte.js'
  import { extractItems, isCharacterCollection } from '../../lib/detail-helpers.js'
  import {
    isWeaponType,
    ownedIdsFor,
    collectionUpdatesByKey,
    filterByRarity,
    hasItemNames,
    categorizeItems,
    defaultSelection,
    type CategorySection
  } from '../../lib/detail-data.js'
  import { getCollectionIds, checkCollectionUpdates, fetchWeaponStatModifiers } from '../../lib/services/chrome-messages.js'
  import type { CollectionUpdate, WeaponStatModifiers } from '../../lib/types/messages.js'

  import Tooltip from '../shared/Tooltip.svelte'
  import DetailFilter from './DetailFilter.svelte'
  import DetailScroll from './DetailScroll.svelte'
  import ItemGrid from './items/ItemGrid.svelte'
  import ItemList from './items/ItemList.svelte'
  import CollapsibleSection from './items/CollapsibleSection.svelte'

  interface Props {
    dataType: string
    /** The cached capture, or null until it has loaded */
    data: unknown
    /** Changes whenever DetailView loads a new capture for this view */
    generation: number
    simplePortraits: boolean
    scrolled?: boolean
  }

  let { dataType, data, generation, simplePortraits, scrolled = $bindable(false) }: Props = $props()

  type ElementName = 'fire' | 'water' | 'earth' | 'wind' | 'light' | 'dark'
  let element = $derived((app.auth?.avatar?.element as ElementName) ?? undefined)

  const isCollection = true
  let isArtifact = $derived(dataType === 'collection_artifact')
  let showFilter = $derived(!isArtifact)
  let showSyncDeletions = $derived(!isCharacterCollection(dataType))

  // Ownership data for categorization, for the capture it was loaded with
  let ownedIds = $state<Set<string>>(new Set())
  let ownershipLoadedFor = $state(0)

  // Pending per-item field deltas from check_updates
  let collectionUpdates = $state<Map<string, CollectionUpdate>>(new Map())
  let weaponStatModifiers = $state<WeaponStatModifiers | null>(null)

  let destroyed = false
  onDestroy(() => {
    destroyed = true
  })

  // Filtered items (rarity only, no lv1 exclusion — that's a section now)
  let filteredItems = $derived(
    data
      ? filterByRarity(dataType, extractItems(dataType, data as Record<string, unknown>), app.activeRarityFilters)
      : []
  )

  let categorizedSections = $derived.by((): CategorySection[] => {
    if (filteredItems.length === 0) return []
    return categorizeItems(dataType, filteredItems, ownedIds, collectionUpdates)
  })

  let hasNames = $derived(hasItemNames(filteredItems))

  // Load ownership for each capture DetailView hands over: on open, and
  // again when new pages are captured for this view.
  $effect(() => {
    const gen = generation
    if (!gen) return
    untrack(() => load(gen))
  })

  // Tick the default selection once per capture, after ownership has loaded.
  // Not $state: the effect would otherwise depend on it.
  let selectionInitialisedFor = 0
  $effect(() => {
    if (ownershipLoadedFor !== generation || categorizedSections.length === 0) return
    if (selectionInitialisedFor === generation) return
    selectionInitialisedFor = generation
    app.selectedItems = defaultSelection(categorizedSections, app.manuallyUnchecked)
  })

  async function load(gen: number) {
    // Drops results once a newer capture has arrived or the view has gone.
    const current = () => !destroyed && gen === generation
    ownedIds = new Set()
    collectionUpdates = new Map()

    if (isWeaponType(dataType)) void loadWeaponStatModifiers(current)

    await Promise.all([loadOwnedIds(current), loadCollectionUpdates(current)])
    // Only once both have landed, so items with updates are ticked too
    if (current()) ownershipLoadedFor = gen
  }

  async function loadOwnedIds(current: () => boolean) {
    try {
      const response = await getCollectionIds()
      if (!current()) return
      ownedIds = ownedIdsFor(dataType, response)
    } catch {
      if (current()) ownedIds = new Set()
    }
  }

  async function loadCollectionUpdates(current: () => boolean) {
    // Artifacts don't support partial updates; skip them.
    if (dataType.includes('artifact')) return
    try {
      const response = await checkCollectionUpdates(dataType)
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

  async function loadWeaponStatModifiers(current: () => boolean) {
    const modifiers = await fetchWeaponStatModifiers()
    if (current()) weaponStatModifiers = modifiers
  }
</script>

{#snippet syncToggle()}
  <Tooltip content={m.filter_enable_sync_desc()}>
    <button
      class="sync-toggle contained"
      class:active={app.enableFullSync}
      onclick={() => { app.enableFullSync = !app.enableFullSync }}
    >
      {m.filter_enable_sync()}
    </button>
  </Tooltip>
{/snippet}

<div class="detail-meta" class:scrolled>
  <div class="detail-meta-left">
    {#if showFilter}
      <DetailFilter {element} />
    {:else if isArtifact && showSyncDeletions}
      {@render syncToggle()}
    {/if}
  </div>
  {#if showSyncDeletions && !isArtifact}
    {@render syncToggle()}
  {/if}
</div>

<DetailScroll bind:scrolled>
  {#if data}
    {#if categorizedSections.length > 0}
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
</DetailScroll>
