<script lang="ts">
  import { app } from '../../../lib/state/app.svelte.js'
  import { getItemImageUrl, getArtifactLabels, getOwnershipId } from '../../../lib/detail-helpers.js'
  import * as m from '../../../paraglide/messages.js'
  import type { RawGameItem } from '../../../lib/detail-helpers.js'
  import type { CollectionUpdate } from '../../../lib/types/messages.js'
  import Icon from '../../shared/Icon.svelte'
  import RichTooltip from '../../shared/RichTooltip.svelte'

  interface Props {
    items: Array<{ item: RawGameItem; originalIndex: number }>
    dataType: string
    isCollection: boolean
    simplePortraits?: boolean
    collectionUpdates?: Map<string, CollectionUpdate>
  }

  let { items, dataType, isCollection, simplePortraits = false, collectionUpdates = new Map() }: Props = $props()

  let isArtifactType = $derived(dataType.includes('artifact'))

  function getUpdate(item: RawGameItem): CollectionUpdate | undefined {
    const key = getOwnershipId(dataType, item)
    if (!key) return undefined
    return collectionUpdates.get(key)
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
</script>

<div class="item-list">
  {#each items as { item, originalIndex } (originalIndex)}
    {@const pendingUpdate = getUpdate(item)}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="list-item"
      class:selectable={isCollection}
      class:has-update={!!pendingUpdate}
      data-index={originalIndex}
      onclick={() => isCollection && toggleItem(originalIndex)}
    >
      {#if pendingUpdate}
        <RichTooltip>
          {#snippet content()}
            <div class="update-tooltip">
              <div class="update-tooltip-title">{m.section_has_updates()}</div>
              {#each pendingUpdate.changes as change}
                <div class="update-tooltip-row">
                  <span class="update-tooltip-label">{change.label}</span>
                  <span class="update-tooltip-values">
                    {change.before.display || '—'} → {change.after.display || '—'}
                  </span>
                </div>
              {/each}
            </div>
          {/snippet}
          <img
            class="list-item-image"
            src={getItemImageUrl(dataType, item, simplePortraits)}
            alt=""
          />
        </RichTooltip>
      {:else}
        <img
          class="list-item-image"
          src={getItemImageUrl(dataType, item, simplePortraits)}
          alt=""
        />
      {/if}
      <div class="list-item-info">
        <span class="list-item-name">
          {#if pendingUpdate}<span class="update-indicator" aria-hidden="true"></span>{/if}
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
  {/each}
</div>
