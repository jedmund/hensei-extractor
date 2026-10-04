<script lang="ts">
  import { app } from '../../../lib/state/app.svelte.js'
  import { getItemImageUrl, getItemImageFallbackUrl, getGridClass, getCharacterModifiers, getWeaponModifiers, getOwnershipId, isWeaponOrSummonCollection, type WeaponStatModifier } from '../../../lib/detail-helpers.js'
  import { getCharacterBaseArtUrl } from '../../../lib/images.js'
  import * as m from '../../../paraglide/messages.js'
  import type { RawGameItem } from '../../../lib/detail-helpers.js'
  import type { CollectionUpdate } from '../../../lib/types/messages.js'
  import Icon from '../../shared/Icon.svelte'
  import RichTooltip from '../../shared/RichTooltip.svelte'
  import CharacterModifiers from '../modifiers/CharacterModifiers.svelte'
  import WeaponModifiers from '../modifiers/WeaponModifiers.svelte'

  interface Props {
    items: Array<{ item: RawGameItem; originalIndex: number }>
    dataType: string
    isCollection: boolean
    simplePortraits?: boolean
    weaponStatModifiers?: Record<string, WeaponStatModifier> | null
    collectionUpdates?: Map<string, CollectionUpdate>
  }

  let { items, dataType, isCollection, simplePortraits = false, weaponStatModifiers = null, collectionUpdates = new Map() }: Props = $props()

  function getUpdate(item: RawGameItem): CollectionUpdate | undefined {
    const key = getOwnershipId(dataType, item)
    if (!key) return undefined
    return collectionUpdates.get(key)
  }

  let gridClass = $derived(getGridClass(dataType))
  let isCharacterType = $derived(dataType.includes('npc') || dataType.includes('character'))
  let isWeaponType = $derived(dataType.includes('weapon') || dataType.startsWith('stash_weapon'))

  // Per-item element-variant fallback URLs (resolved asynchronously from the
  // cached /weapons/element_variants map). Keyed by originalIndex.
  let variantFallbackUrls = $state<Map<number, string>>(new Map())

  $effect(() => {
    const currentItems = items
    currentItems.forEach(({ item, originalIndex }) => {
      if (variantFallbackUrls.has(originalIndex)) return
      void getItemImageFallbackUrl(dataType, item).then((url) => {
        if (!url) return
        const next = new Map(variantFallbackUrls)
        next.set(originalIndex, url)
        variantFallbackUrls = next
      })
    })
  })

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

  function handleImageError(index: number, e: Event) {
    const img = e.target as HTMLImageElement
    const stage = img.dataset.fallbackStage ?? '0'

    if (stage === '0') {
      // Characters have no suffix-less art, so fall back to their _01 art;
      // weapons and summons fall back to their base ID.
      const stripped = isCharacterType
        ? getCharacterBaseArtUrl(img.src)
        : img.src.replace(/_\d+\.jpg$/, '.jpg')
      if (stripped && stripped !== img.src) {
        img.dataset.fallbackStage = '1'
        img.src = stripped
        return
      }
    }

    if (stage === '0' || stage === '1') {
      const variantFallback = variantFallbackUrls.get(index)
      if (variantFallback && variantFallback !== img.src) {
        img.dataset.fallbackStage = '2'
        img.src = variantFallback
        return
      }
    }

    img.dataset.fallbackStage = 'final'
    img.classList.add('image-failed')
  }
</script>

<div class="item-grid {gridClass} square-cells">
  {#each items as { item, originalIndex } (originalIndex)}
    {@const pendingUpdate = getUpdate(item)}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
      class="grid-item"
      class:selectable={isCollection}
      class:has-update={!!pendingUpdate}
      data-index={originalIndex}
      onclick={() => isCollection && toggleItem(originalIndex)}
    >
      {#if isCharacterType}
        {@const charMods = getCharacterModifiers(item)}
        <CharacterModifiers perpetuity={charMods.perpetuity} />
      {:else if isWeaponType}
        {@const wMods = getWeaponModifiers(item)}
        <WeaponModifiers mods={wMods} {weaponStatModifiers} />
      {/if}
      {#if pendingUpdate}
        <div class="update-trigger">
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
              src={getItemImageUrl(dataType, item, simplePortraits)}
              alt=""
              onerror={(e) => handleImageError(originalIndex, e)}
            />
          </RichTooltip>
        </div>
        <span class="update-indicator" aria-hidden="true"></span>
      {:else}
        <img
          src={getItemImageUrl(dataType, item, simplePortraits)}
          alt=""
          onerror={(e) => handleImageError(originalIndex, e)}
        />
      {/if}
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
