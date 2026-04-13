<script lang="ts">
  import { app } from '../../../lib/state/app.svelte.js'
  import { getItemImageUrl, getArtifactLabels } from '../../../lib/detail-helpers.js'
  import { getCollectionIds } from '../../../lib/services/chrome-messages.js'
  import * as m from '../../../paraglide/messages.js'
  import { onMount } from 'svelte'
  import type { RawGameItem } from '../../../lib/detail-helpers.js'
  import Icon from '../../shared/Icon.svelte'
  import Tooltip from '../../shared/Tooltip.svelte'

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
    <Tooltip content={m.stat_already_owned()} disabled={!(isCollection && isOwned(item))}>
    <div
      class="list-item"
      class:selectable={isCollection}
      class:owned={isCollection && isOwned(item)}
      data-index={originalIndex}
      data-ownership-id={getOwnershipId(item)}
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
          <span class="checkbox-indicator"><Icon name="check" size={14} /></span>
        </label>
      {/if}
    </div>
    </Tooltip>
  {/each}
</div>
