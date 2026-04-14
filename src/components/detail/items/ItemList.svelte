<script lang="ts">
  import { app } from '../../../lib/state/app.svelte.js'
  import { getItemImageUrl, getArtifactLabels } from '../../../lib/detail-helpers.js'
  import type { RawGameItem } from '../../../lib/detail-helpers.js'
  import Icon from '../../shared/Icon.svelte'

  interface Props {
    items: Array<{ item: RawGameItem; originalIndex: number }>
    dataType: string
    isCollection: boolean
    simplePortraits?: boolean
  }

  let { items, dataType, isCollection, simplePortraits = false }: Props = $props()

  let isArtifactType = $derived(dataType.includes('artifact'))

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
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="list-item"
      class:selectable={isCollection}
      data-index={originalIndex}
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
  {/each}
</div>
