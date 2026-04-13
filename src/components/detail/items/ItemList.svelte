<script lang="ts">
  import { app } from '../../../lib/state/app.svelte.js'
  import { getItemImageUrl, getArtifactLabels } from '../../../lib/detail-helpers.js'
  import { getCollectionIds } from '../../../lib/services/chrome-messages.js'
  import * as m from '../../../paraglide/messages.js'
  import { onMount } from 'svelte'
  import type { RawGameItem } from '../../../lib/detail-helpers.js'

  interface Props {
    items: Array<{ item: RawGameItem; originalIndex: number }>
    dataType: string
    isCollection: boolean
    simplePortraits?: boolean
  }

  let { items, dataType, isCollection, simplePortraits = false }: Props = $props()

  let ownedIds = $state<Set<string>>(new Set())

  let isCharacterType = $derived(dataType.includes('npc') || dataType.includes('character'))
  let isArtifactType = $derived(dataType.includes('artifact'))

  const CHECK_ICON = `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M12.7139 4.04764C13.14 3.52854 13.0837 2.74594 12.5881 2.29964C12.0925 1.85335 11.3453 1.91237 10.9192 2.43147L5.28565 9.94404L3.02018 7.32366C2.55804 6.83959 1.80875 6.83959 1.34661 7.32366C0.884464 7.80772 0.884464 8.59255 1.34661 9.07662L4.50946 12.6369C4.9716 13.121 5.72089 13.121 6.18303 12.6369C6.2359 12.5816 6.28675 12.5271 6.33575 12.4674L12.7139 4.04764Z"/></svg>`

  function getOwnershipId(item: RawGameItem): string {
    if (isCharacterType) return item.master?.id?.toString() || ''
    if (isArtifactType) return item.id?.toString() || ''
    return item.param?.id?.toString() || ''
  }

  function toggleItem(index: number) {
    const next = new Set(app.selectedItems)
    const unchecked = new Set(app.manuallyUnchecked)
    if (next.has(index)) {
      next.delete(index)
      unchecked.add(index)
    } else {
      next.add(index)
      unchecked.delete(index)
    }
    app.selectedItems = next
    app.manuallyUnchecked = unchecked
  }

  function isOwned(item: RawGameItem): boolean {
    const id = getOwnershipId(item)
    return id ? ownedIds.has(id) : false
  }

  onMount(async () => {
    if (!isCollection) return
    try {
      const response = await getCollectionIds()
      if (response.error) return
      if (dataType.includes('weapon') || dataType.startsWith('stash_weapon')) {
        ownedIds = new Set(response.weapons || [])
      } else if (dataType.includes('summon') || dataType.startsWith('stash_summon')) {
        ownedIds = new Set(response.summons || [])
      } else if (isArtifactType) {
        ownedIds = new Set(response.artifacts || [])
      } else if (isCharacterType) {
        ownedIds = new Set(response.characters || [])
      }

      if (ownedIds.size > 0) {
        const selected = new Set(app.selectedItems)
        for (const { item, originalIndex } of items) {
          if (isOwned(item) && selected.has(originalIndex)) {
            selected.delete(originalIndex)
          }
        }
        app.selectedItems = selected
      }
    } catch {
      // Not logged in or API error
    }
  })
</script>

<div class="item-list">
  {#each items as { item, originalIndex } (originalIndex)}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="list-item"
      class:selectable={isCollection}
      class:owned={isCollection && isOwned(item)}
      data-index={originalIndex}
      data-ownership-id={getOwnershipId(item)}
      data-tooltip={isCollection && isOwned(item) ? m.stat_already_owned() : undefined}
      onclick={() => isCollection && toggleItem(originalIndex)}
    >
      <img
        class="list-item-image"
        src={getItemImageUrl(dataType, item, simplePortraits)}
        alt=""
      />
      <div class="list-item-info">
        <span class="list-item-name">
          {item.name || item.master?.name || ''}
          {#if item.level || item.lv}
            <span class="list-item-level">Lv.{item.level || item.lv}</span>
          {/if}
        </span>
        {#if isArtifactType}
          {@html getArtifactLabels(item)}
        {/if}
      </div>
      {#if isCollection}
        <label
          class="item-checkbox"
          class:checked={app.selectedItems.has(originalIndex)}
          data-index={originalIndex}
        >
          <span class="checkbox-indicator">{@html CHECK_ICON}</span>
        </label>
      {/if}
    </div>
  {/each}
</div>
