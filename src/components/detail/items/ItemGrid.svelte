<script lang="ts">
  import { app } from '../../../lib/state/app.svelte.js'
  import { getItemImageUrl, getGridClass, getCharacterModifiers, getWeaponModifiers, isWeaponOrSummonCollection, resolveAwakeningIcon, resolveAugmentIcon, buildAxTooltip } from '../../../lib/detail-helpers.js'
  import { getImageUrl } from '../../../lib/constants.js'
  import { getLocale } from '../../../lib/i18n.js'
  import { getCollectionIds } from '../../../lib/services/chrome-messages.js'
  import * as m from '../../../paraglide/messages.js'
  import { onMount } from 'svelte'

  interface Props {
    items: Array<{ item: any; originalIndex: number }>
    dataType: string
    isCollection: boolean
    simplePortraits?: boolean
    weaponStatModifiers?: Record<string, any> | null
  }

  let { items, dataType, isCollection, simplePortraits = false, weaponStatModifiers = null }: Props = $props()

  let ownedIds = $state<Set<string>>(new Set())
  let raidImageErrors = $state<Set<number>>(new Set())

  let gridClass = $derived(getGridClass(dataType))
  let isCharacterType = $derived(dataType.includes('npc') || dataType.includes('character'))
  let isWeaponType = $derived(dataType.includes('weapon') || dataType.startsWith('stash_weapon'))

  const CHECK_ICON = `<svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor"><path fill-rule="evenodd" clip-rule="evenodd" d="M12.7139 4.04764C13.14 3.52854 13.0837 2.74594 12.5881 2.29964C12.0925 1.85335 11.3453 1.91237 10.9192 2.43147L5.28565 9.94404L3.02018 7.32366C2.55804 6.83959 1.80875 6.83959 1.34661 7.32366C0.884464 7.80772 0.884464 8.59255 1.34661 9.07662L4.50946 12.6369C4.9716 13.121 5.72089 13.121 6.18303 12.6369C6.2359 12.5816 6.28675 12.5271 6.33575 12.4674L12.7139 4.04764Z"/></svg>`

  function getOwnershipId(item: any): string {
    if (isCharacterType) return item.master?.id?.toString() || ''
    if (dataType.includes('artifact')) return item.id?.toString() || ''
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

  function handleImageError(index: number, e: Event) {
    const img = e.target as HTMLImageElement
    const fallbackSrc = img.src.replace(/_\d+\.jpg$/, '.jpg')
    if (img.src !== fallbackSrc && !img.dataset.fallbackAttempted) {
      img.dataset.fallbackAttempted = 'true'
      img.src = fallbackSrc
      return
    }
    const broken = new Set(app.brokenImageIndices)
    broken.add(index)
    app.brokenImageIndices = broken
    const selected = new Set(app.selectedItems)
    selected.delete(index)
    app.selectedItems = selected
  }

  function isOwned(item: any): boolean {
    const id = getOwnershipId(item)
    return id ? ownedIds.has(id) : false
  }

  onMount(async () => {
    if (!isCollection) return
    try {
      const response = await getCollectionIds()
      if (response.error) return
      const data = response.data as any
      if (dataType.includes('weapon') || dataType.startsWith('stash_weapon')) {
        ownedIds = new Set(data?.weapons || [])
      } else if (dataType.includes('summon') || dataType.startsWith('stash_summon')) {
        ownedIds = new Set(data?.summons || [])
      } else if (dataType.includes('artifact')) {
        ownedIds = new Set(data?.artifacts || [])
      } else if (isCharacterType) {
        ownedIds = new Set(data?.characters || [])
      }

      // Uncheck owned items
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

<div class="item-grid {gridClass} square-cells">
  {#each items as { item, originalIndex } (originalIndex)}
    {#if !app.brokenImageIndices.has(originalIndex)}
      <!-- svelte-ignore a11y_click_events_have_key_events -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        class="grid-item"
        class:selectable={isCollection}
        class:owned={isCollection && isOwned(item)}
        data-index={originalIndex}
        data-ownership-id={getOwnershipId(item)}
        data-tooltip={isCollection && isOwned(item) ? m.stat_already_owned() : undefined}
        onclick={() => isCollection && toggleItem(originalIndex)}
      >
        {#if isCharacterType}
          {@const charMods = getCharacterModifiers(item)}
          {#if charMods.perpetuity}
            <div class="char-modifiers">
              <img class="perpetuity-ring" src="icons/perpetuity/filled.svg" alt={m.stat_perpetuity_ring()} data-tooltip={m.stat_perpetuity_ring()}>
            </div>
          {/if}
        {:else if isWeaponType}
          {@const wMods = getWeaponModifiers(item)}
          {#if wMods.awakening || wMods.axSkill || wMods.befoulment || wMods.weaponKeys.length > 0}
            <div class="weapon-modifiers">
              {#if wMods.awakening}
                <img class="awakening-icon" src={getImageUrl(`awakening/${resolveAwakeningIcon(wMods.awakening.form_name)}.png`)} alt={m.stat_awakening()} data-tooltip="{wMods.awakening.form_name} Lv.{wMods.awakening.level}">
              {/if}
              {#if wMods.axSkill || wMods.befoulment || wMods.weaponKeys.length > 0}
                <div class="weapon-skills">
                  {#if wMods.axSkill}
                    {@const axIconFile = resolveAugmentIcon(wMods.axSkill.iconImage || 'ex_skill_atk')}
                    <img class="ax-skill-icon" src={getImageUrl(`ax/${axIconFile}.png`)} alt={m.stat_ax_skills()} data-tooltip={buildAxTooltip(wMods.axSkill.skill, wMods.axSkill.iconImage, weaponStatModifiers, getLocale())}>
                  {/if}
                  {#if wMods.befoulment}
                    {@const befoulIconFile = resolveAugmentIcon(wMods.befoulment.iconImage || 'ex_skill_def_down')}
                    <img class="befoulment-icon" src={getImageUrl(`ax/${befoulIconFile}.png`)} alt={m.stat_befoulment()} data-tooltip="<div>{m.stat_befoulment()}: {wMods.befoulment.skill?.show_value || 'Befouled'}</div><div>{m.stat_exorcism()} {wMods.befoulment.exorcismLevel}/{wMods.befoulment.maxExorcismLevel}</div>">
                  {/if}
                  {#each wMods.weaponKeys as slug}
                    <img class="weapon-key-icon" src={getImageUrl(`weapon-keys/${slug}.png`)} alt={slug} data-tooltip={slug}>
                  {/each}
                </div>
              {/if}
            </div>
          {/if}
        {/if}
        <img
          src={getItemImageUrl(dataType, item, simplePortraits)}
          alt=""
          onerror={(e) => isCollection && handleImageError(originalIndex, e)}
        />
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
    {/if}
  {/each}
</div>
