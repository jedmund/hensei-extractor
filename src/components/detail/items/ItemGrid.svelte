<script lang="ts">
  import { app } from '../../../lib/state/app.svelte.js'
  import { getItemImageUrl, getGridClass, getCharacterModifiers, getWeaponModifiers, isWeaponOrSummonCollection, resolveAwakeningIcon, resolveAugmentIcon, buildAxTooltipLines, type WeaponStatModifier } from '../../../lib/detail-helpers.js'
  import { getImageUrl } from '../../../lib/constants.js'
  import { getLocale } from '../../../lib/i18n.js'
  import { getCollectionIds } from '../../../lib/services/chrome-messages.js'
  import * as m from '../../../paraglide/messages.js'
  import { onMount } from 'svelte'
  import type { RawGameItem } from '../../../lib/detail-helpers.js'
  import Icon from '../../shared/Icon.svelte'
  import Tooltip from '../../shared/Tooltip.svelte'
  import RichTooltip from '../../shared/RichTooltip.svelte'

  interface Props {
    items: Array<{ item: RawGameItem; originalIndex: number }>
    dataType: string
    isCollection: boolean
    simplePortraits?: boolean
    weaponStatModifiers?: Record<string, WeaponStatModifier> | null
  }

  let { items, dataType, isCollection, simplePortraits = false, weaponStatModifiers = null }: Props = $props()

  let ownedIds = $state<Set<string>>(new Set())
  let raidImageErrors = $state<Set<number>>(new Set())

  let gridClass = $derived(getGridClass(dataType))
  let isCharacterType = $derived(dataType.includes('npc') || dataType.includes('character'))
  let isWeaponType = $derived(dataType.includes('weapon') || dataType.startsWith('stash_weapon'))


  function getOwnershipId(item: RawGameItem): string {
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
      } else if (dataType.includes('artifact')) {
        ownedIds = new Set(response.artifacts || [])
      } else if (isCharacterType) {
        ownedIds = new Set(response.characters || [])
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
      <Tooltip content={m.stat_already_owned()} disabled={!(isCollection && isOwned(item))}>
      <div
        class="grid-item"
        class:selectable={isCollection}
        class:owned={isCollection && isOwned(item)}
        data-index={originalIndex}
        data-ownership-id={getOwnershipId(item)}
        onclick={() => isCollection && toggleItem(originalIndex)}
      >
        {#if isCharacterType}
          {@const charMods = getCharacterModifiers(item)}
          {#if charMods.perpetuity}
            <div class="char-modifiers">
              <Tooltip content={m.stat_perpetuity_ring()}><img class="perpetuity-ring" src="icons/perpetuity/filled.svg" alt={m.stat_perpetuity_ring()}></Tooltip>
            </div>
          {/if}
        {:else if isWeaponType}
          {@const wMods = getWeaponModifiers(item)}
          {#if wMods.awakening || wMods.axSkill || wMods.befoulment || wMods.weaponKeys.length > 0}
            <div class="weapon-modifiers">
              {#if wMods.awakening}
                <Tooltip content="{wMods.awakening.form_name} Lv.{wMods.awakening.level}"><img class="awakening-icon" src={getImageUrl(`awakening/${resolveAwakeningIcon(wMods.awakening.form_name)}.png`)} alt={m.stat_awakening()}></Tooltip>
              {/if}
              {#if wMods.axSkill || wMods.befoulment || wMods.weaponKeys.length > 0}
                <div class="weapon-skills">
                  {#if wMods.axSkill}
                    {@const axIconFile = resolveAugmentIcon(wMods.axSkill.iconImage || 'ex_skill_atk')}
                    <RichTooltip>
                      {#snippet content()}{#each buildAxTooltipLines(wMods.axSkill!.skill, wMods.axSkill!.iconImage, weaponStatModifiers, getLocale()) as line}<div>{line}</div>{/each}{/snippet}
                      <img class="ax-skill-icon" src={getImageUrl(`ax/${axIconFile}.png`)} alt={m.stat_ax_skills()}>
                    </RichTooltip>
                  {/if}
                  {#if wMods.befoulment}
                    {@const befoulIconFile = resolveAugmentIcon(wMods.befoulment.iconImage || 'ex_skill_def_down')}
                    <RichTooltip>
                      {#snippet content()}<div>{m.stat_befoulment()}: {wMods.befoulment!.skill?.show_value || 'Befouled'}</div><div>{m.stat_exorcism()} {wMods.befoulment!.exorcismLevel}/{wMods.befoulment!.maxExorcismLevel}</div>{/snippet}
                      <img class="befoulment-icon" src={getImageUrl(`ax/${befoulIconFile}.png`)} alt={m.stat_befoulment()}>
                    </RichTooltip>
                  {/if}
                  {#each wMods.weaponKeys as slug}
                    <Tooltip content={slug}><img class="weapon-key-icon" src={getImageUrl(`weapon-keys/${slug}.png`)} alt={slug}></Tooltip>
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
            <span class="checkbox-indicator"><Icon name="check" size={14} /></span>
          </label>
        {/if}
      </div>
      </Tooltip>
    {/if}
  {/each}
</div>
